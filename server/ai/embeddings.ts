/**
 * Embedding provider — thin fetch-based adapter.
 *
 * Supports OpenAI text-embedding-3-small (1536-dim) by default.
 * Additional providers can be registered with the same interface.
 * Keeps zero runtime deps beyond what's already in the tree.
 */
import { config } from "../config.js";
import { logger } from "../observability/logger.js";

export const EMBEDDING_DIM = 1536;

export interface EmbeddingProvider {
  name: string;
  model: string;
  embed(texts: string[]): Promise<number[][]>;
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = "openai";
  model = "text-embedding-3-small";

  async embed(texts: string[]): Promise<number[][]> {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY not set — cannot generate embeddings");
    }
    if (texts.length === 0) return [];

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        dimensions: EMBEDDING_DIM,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Embedding API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[]; index: number }> };
    // Preserve input order
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }
}

let provider: EmbeddingProvider = new OpenAIEmbeddingProvider();

export function setEmbeddingProvider(p: EmbeddingProvider): void {
  provider = p;
  logger.info("Embedding provider replaced", { name: p.name, model: p.model });
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return provider;
}

/**
 * Embed a batch of texts, chunked to respect API limits.
 * OpenAI supports up to 2048 inputs per request; we chunk at 96 to keep requests snappy.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH = 96;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const embeddings = await provider.embed(slice);
    results.push(...embeddings);
  }
  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await provider.embed([text]);
  if (!vec) throw new Error("Empty embedding response");
  return vec;
}

/**
 * Format a number[] as a pgvector literal: '[0.1,0.2,...]'.
 * Safe because we control every value (numbers only).
 */
export function toPgVector(vec: number[]): string {
  return "[" + vec.map((n) => Number(n).toFixed(7)).join(",") + "]";
}
