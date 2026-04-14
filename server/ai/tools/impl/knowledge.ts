/**
 * Knowledge Base Tools — CRUD for knowledge documents, search, and document ingestion.
 * Gated by document_ingest capability for write operations.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult } from "../types.js";

// ─── List Knowledge Documents ───
toolRegistry.register({
  name: "list_knowledge_docs",
  description: "List knowledge base documents. Shows SOPs, manuals, guides, policies, and other reference material stored in the system.",
  inputSchema: z.object({
    category: z.string().optional().describe("Filter by category: sop, manual, guide, policy, faq, other"),
    search: z.string().optional().describe("Search term to filter results"),
  }),
  async handler(input): Promise<ToolResult> {
    const allDocs = await storage.getKnowledgeDocuments(input.category as string | undefined);
    const docs = input.search
      ? allDocs.filter((d: any) => (d.title ?? '').toLowerCase().includes((input.search as string).toLowerCase()))
      : allDocs;
    return {
      content: `${docs.length} knowledge document(s)${input.category ? ` in "${input.category}"` : ""}${input.search ? ` matching "${input.search}"` : ""}.`,
      data: docs,
      uiBlock: {
        type: "data_table", title: "Knowledge Base",
        columns: [
          { key: "id", label: "ID" },
          { key: "title", label: "Title" },
          { key: "category", label: "Category" },
          { key: "updatedAt", label: "Updated" },
        ],
        rows: docs.slice(0, 20).map(d => ({
          id: d.id,
          title: (d as any).title ?? "Untitled",
          category: (d as any).category ?? "—",
          updatedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "—",
        })),
      },
    };
  },
});

// ─── Get Knowledge Document ───
toolRegistry.register({
  name: "get_knowledge_doc",
  description: "Retrieve the full content of a knowledge document. Use when the user asks about a specific SOP, policy, or wants to read reference material.",
  inputSchema: z.object({
    documentId: z.number().describe("Knowledge document ID"),
  }),
  async handler(input): Promise<ToolResult> {
    const doc = await storage.getKnowledgeDocument(input.documentId as number);
    if (!doc) return { content: "Document not found.", isError: true };
    return {
      content: `# ${(doc as any).title}\n\n${(doc as any).content ?? "No content."}`,
      data: doc,
      uiBlock: {
        type: "entity_card", entityType: "knowledge_doc", entityId: doc.id,
        title: (doc as any).title ?? "Untitled",
        subtitle: `Category: ${(doc as any).category ?? "general"}`,
        fields: [
          { label: "Category", value: (doc as any).category ?? "—" },
          { label: "Created", value: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "—" },
          { label: "Updated", value: doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : "—" },
        ],
      },
    };
  },
});

// ─── Create Knowledge Document ───
toolRegistry.register({
  name: "create_knowledge_doc",
  description: "Create a new knowledge document — SOP, manual, guide, FAQ, or policy. Use when the user dictates procedures, wants to save documentation, or asks you to write up a process.",
  inputSchema: z.object({
    title: z.string().describe("Document title"),
    content: z.string().describe("Full document content (Markdown supported)"),
    category: z.string().optional().describe("Category: sop, manual, guide, policy, faq, other"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
  }),
  requiredCapability: "document_ingest",
  async handler(input, ctx): Promise<ToolResult> {
    const contentStr = input.content as string;
    const doc = await storage.createKnowledgeDocument({
      workspaceId: ctx.workspaceId,
      title: input.title as string,
      filename: `${(input.title as string).replace(/\s+/g, '_').toLowerCase()}.md`,
      mimeType: "text/markdown",
      size: contentStr.length,
      storageKey: `knowledge/ai-${Date.now()}.md`,
      uploadedBy: ctx.userId,
      category: (input.category as string) || "other",
      tags: input.tags as string[] | undefined,
    });
    return {
      content: `Knowledge document created: "${(doc as any).title}" (ID: ${doc.id}).`,
      uiBlock: { type: "alert", severity: "success", title: "Document Created", message: `"${(doc as any).title}" added to the Knowledge Base.` },
    };
  },
});

// ─── Update Knowledge Document ───
toolRegistry.register({
  name: "update_knowledge_doc",
  description: "Update an existing knowledge document — edit content, title, or category.",
  inputSchema: z.object({
    documentId: z.number().describe("Document ID"),
    title: z.string().optional().describe("New title"),
    content: z.string().optional().describe("Updated content (replaces entire body)"),
    category: z.string().optional().describe("New category"),
    tags: z.array(z.string()).optional().describe("Updated tags"),
  }),
  requiredCapability: "document_ingest",
  async handler(input): Promise<ToolResult> {
    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.content) updates.content = input.content;
    if (input.category) updates.category = input.category;
    if (input.tags) updates.tags = input.tags;
    const doc = await storage.updateKnowledgeDocument(input.documentId as number, updates);
    if (!doc) return { content: "Document not found.", isError: true };
    return {
      content: `Knowledge document #${doc.id} "${(doc as any).title}" updated.`,
      uiBlock: { type: "alert", severity: "success", title: "Document Updated", message: `"${(doc as any).title}" saved.` },
    };
  },
});

// ─── Delete Knowledge Document ───
toolRegistry.register({
  name: "delete_knowledge_doc",
  description: "Delete a knowledge document. Ask for confirmation before executing.",
  inputSchema: z.object({
    documentId: z.number().describe("Document ID to delete"),
    confirmed: z.boolean().describe("Must be true to proceed — ask user to confirm first"),
  }),
  requiredCapability: "document_ingest",
  async handler(input): Promise<ToolResult> {
    if (!(input.confirmed as boolean)) {
      return {
        content: "Please confirm you want to delete this document.",
        uiBlock: {
          type: "confirmation",
          title: "Delete Knowledge Document?",
          message: "This action cannot be undone.",
          confirmTool: "delete_knowledge_doc",
          confirmParams: { documentId: input.documentId as number, confirmed: true },
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
        },
      };
    }
    await storage.deleteKnowledgeDocument(input.documentId as number);
    return {
      content: `Knowledge document #${input.documentId} deleted.`,
      uiBlock: { type: "alert", severity: "info", title: "Document Deleted", message: "The document has been removed from the Knowledge Base." },
    };
  },
});
