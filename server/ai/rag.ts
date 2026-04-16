/**
 * RAG service — chunking, indexing, and similarity retrieval over the
 * knowledge_documents table.
 *
 * Uses pgvector with cosine distance (HNSW index). All queries are scoped to
 * the current workspace via the storage base helpers.
 */
import { pool, aiPool } from "../db.js";
import { getWorkspaceScope } from "../middleware/workspaceContext.js";
import { embedBatch, embedQuery, toPgVector } from "./embeddings.js";
import { logger } from "../observability/logger.js";

// ─── Chunking ─────────────────────────────────────────────────────────────

const CHUNK_TARGET_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 150;

/**
 * Split plain text into overlapping chunks that respect paragraph and sentence
 * boundaries where possible. Output chunks are ≤ CHUNK_TARGET_CHARS.
 */
export function chunkText(input: string): string[] {
  const text = input.replace(/\r\n/g, "\n").trim();
  if (text.length === 0) return [];
  if (text.length <= CHUNK_TARGET_CHARS) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) chunks.push(trimmed);
    // Start the next chunk with a trailing overlap from the previous one to
    // keep cross-boundary context retrievable.
    current = trimmed.length > CHUNK_OVERLAP_CHARS
      ? trimmed.slice(-CHUNK_OVERLAP_CHARS)
      : "";
  };

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= CHUNK_TARGET_CHARS) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }
    if (para.length <= CHUNK_TARGET_CHARS) {
      pushCurrent();
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }
    // Paragraph itself is too long — split by sentence.
    const sentences = para.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      if (current.length + s.length + 1 > CHUNK_TARGET_CHARS) {
        pushCurrent();
      }
      current = current ? `${current} ${s}` : s;
    }
  }
  pushCurrent();
  return chunks.filter((c) => c.length > 0);
}

// ─── Indexing ─────────────────────────────────────────────────────────────

/**
 * Re-index a knowledge document: chunk, embed, upsert chunks into the table.
 * Existing chunks for the document are deleted first so re-indexing stays idempotent.
 */
export async function indexDocument(
  documentId: number,
  content: string,
): Promise<{ chunks: number }> {
  const workspaceId = getWorkspaceScope();
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    await pool.query("DELETE FROM knowledge_chunks WHERE document_id = $1 AND workspace_id = $2", [
      documentId,
      workspaceId,
    ]);
    return { chunks: 0 };
  }

  const embeddings = await embedBatch(chunks);
  if (embeddings.length !== chunks.length) {
    throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM knowledge_chunks WHERE document_id = $1 AND workspace_id = $2",
      [documentId, workspaceId],
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      const embedding = embeddings[i];
      if (!chunkContent || !embedding) continue;
      await client.query(
        `INSERT INTO knowledge_chunks (workspace_id, document_id, chunk_index, content, token_count, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [
          workspaceId,
          documentId,
          i,
          chunkContent,
          Math.ceil(chunkContent.length / 4), // rough token estimate
          toPgVector(embedding),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  logger.info("Document indexed", { documentId, chunkCount: chunks.length });
  return { chunks: chunks.length };
}

export async function deleteDocumentIndex(documentId: number): Promise<void> {
  const workspaceId = getWorkspaceScope();
  await pool.query("DELETE FROM knowledge_chunks WHERE document_id = $1 AND workspace_id = $2", [
    documentId,
    workspaceId,
  ]);
}

// ─── Retrieval ────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  content: string;
  distance: number;
  score: number; // 1 - distance (cosine similarity)
}

export async function retrieve(
  query: string,
  opts: { topK?: number; minScore?: number; category?: string } = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? 6;
  const minScore = opts.minScore ?? 0.25;
  const workspaceId = getWorkspaceScope();

  const queryVec = await embedQuery(query);
  const vec = toPgVector(queryVec);

  // Use aiPool — isolated from main app traffic, so a slow embedding call
  // can't starve request-serving connections.
  const sql = opts.category
    ? `SELECT kc.id, kc.document_id, kd.title, kc.content,
              kc.embedding <=> $1::vector AS distance
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kc.workspace_id = $2 AND kd.category = $3
       ORDER BY kc.embedding <=> $1::vector
       LIMIT $4`
    : `SELECT kc.id, kc.document_id, kd.title, kc.content,
              kc.embedding <=> $1::vector AS distance
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kc.workspace_id = $2
       ORDER BY kc.embedding <=> $1::vector
       LIMIT $3`;

  const params = opts.category ? [vec, workspaceId, opts.category, topK] : [vec, workspaceId, topK];
  const { rows } = await aiPool.query<{
    id: number;
    document_id: number;
    title: string;
    content: string;
    distance: number;
  }>(sql, params);

  return rows
    .map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      documentTitle: r.title,
      content: r.content,
      distance: Number(r.distance),
      score: 1 - Number(r.distance),
    }))
    .filter((r) => r.score >= minScore);
}

/**
 * Format retrieved chunks as a system-prompt context block.
 * Keeps total size bounded to ~3000 chars to preserve context budget.
 */
export function formatRagContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const MAX_CHARS = 3000;
  const blocks: string[] = [];
  let total = 0;

  for (const c of chunks) {
    const block = `[${c.documentTitle}] ${c.content}`;
    if (total + block.length > MAX_CHARS) break;
    blocks.push(block);
    total += block.length;
  }

  return "\n\nRelevant knowledge base excerpts:\n" + blocks.join("\n---\n");
}

/**
 * Convenience: retrieve + format in one call. Returns empty string on any error
 * so callers can add RAG opportunistically without hardening every call site.
 */
export async function retrieveContext(query: string, topK = 6): Promise<string> {
  try {
    const chunks = await retrieve(query, { topK });
    return formatRagContext(chunks);
  } catch (err) {
    logger.warn("RAG retrieval failed, continuing without context", {
      error: (err as Error).message,
    });
    return "";
  }
}
