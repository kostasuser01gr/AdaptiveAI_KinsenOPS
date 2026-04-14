import type { Express } from "express";
import { z } from "zod/v4";
import fs from "fs/promises";
import path from "path";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { requireEntitlement } from "../entitlements/engine.js";
import { requireCapability } from "../capabilities/engine.js";
import { recordUsage } from "../metering/service.js";
import { documentStorage, validateUpload, LOCAL_UPLOAD_DIR } from "../document-storage.js";
import {
  insertFileAttachmentSchema, insertKnowledgeDocumentSchema,
} from "../../shared/schema.js";

export function registerDocumentRoutes(app: Express) {
  // FILE ATTACHMENTS
  app.get("/api/file-attachments", requireAuth, async (req, res, next) => {
    try {
      const entityType = req.query.entityType;
      const entityId = req.query.entityId;
      if (typeof entityType !== 'string' || typeof entityId !== 'string') {
        return res.status(400).json({ message: "entityType and entityId query params required" });
      }
      res.json(await storage.getFileAttachments(entityType, entityId));
    } catch (e) { next(e); }
  });
  app.post("/api/file-attachments", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createFileAttachment(insertFileAttachmentSchema.parse({ ...req.body, uploadedBy: userId })));
    } catch (e) { next(e); }
  });
  app.delete("/api/file-attachments/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const file = await storage.getFileAttachment(Number(req.params.id));
      if (!file) return res.status(404).json({ message: "Not found" });
      if (file.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteFileAttachment(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // DOCUMENT STORAGE — presigned upload/read
  app.post("/api/documents/presign", requireAuth, async (req, res, next) => {
    try {
      const { entityType, entityId, filename, mimeType, size } = req.body;
      if (!entityType || !entityId || !filename || !mimeType) {
        return res.status(400).json({ message: "entityType, entityId, filename, mimeType required" });
      }
      const validation = await validateUpload(mimeType, size || 0);
      if (!validation.valid) return res.status(400).json({ message: validation.error });
      const target = await documentStorage.generateUploadTarget(entityType, entityId, filename, mimeType);
      res.json(target);
    } catch (e) { next(e); }
  });

  app.put("/api/documents/upload/*key", requireAuth, async (req, res, next) => {
    try {
      const keyParam = req.params.key;
      const key = Array.isArray(keyParam) ? keyParam.join('/') : String(keyParam);
      if (!key || key.includes('..') || key.startsWith('/')) return res.status(400).json({ message: "Invalid key" });
      const filepath = path.resolve(LOCAL_UPLOAD_DIR, key);
      if (!filepath.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) return res.status(400).json({ message: "Invalid key" });
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const MAX_SIZE = 25 * 1024 * 1024;
      for await (const chunk of req) {
        totalSize += chunk.length;
        if (totalSize > MAX_SIZE) return res.status(413).json({ message: "File too large" });
        chunks.push(Buffer.from(chunk));
      }
      await fs.writeFile(filepath, Buffer.concat(chunks));
      res.json({ key, size: totalSize });
    } catch (e) { next(e); }
  });

  app.get("/api/documents/read/*key", requireAuth, async (req, res, next) => {
    try {
      const keyParam = req.params.key;
      const key = Array.isArray(keyParam) ? keyParam.join('/') : String(keyParam);
      if (!key || key.includes('..') || key.startsWith('/')) return res.status(400).json({ message: "Invalid key" });
      const filepath = path.resolve(LOCAL_UPLOAD_DIR, key);
      if (!filepath.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) return res.status(400).json({ message: "Invalid key" });
      try {
        await fs.access(filepath);
      } catch {
        return res.status(404).json({ message: "File not found" });
      }
      res.sendFile(filepath);
    } catch (e) { next(e); }
  });

  // KNOWLEDGE BASE DOCUMENTS
  const kbDocPatchSchema = z.object({
    title: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict();

  app.get("/api/knowledge-base/documents", requireAuth, async (req, res, next) => {
    try {
      const category = req.query.category ? String(req.query.category) : undefined;
      res.json(await storage.getKnowledgeDocuments(category));
    } catch (e) { next(e); }
  });

  app.get("/api/knowledge-base/documents/:id", requireAuth, async (req, res, next) => {
    try {
      const doc = await storage.getKnowledgeDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ message: "Not found" });
      res.json(doc);
    } catch (e) { next(e); }
  });

  app.post("/api/knowledge-base/documents", requireAuth, requireCapability("document_ingest"), requireEntitlement("knowledge_ingestion"), auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: 'knowledge_document' }), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const data = insertKnowledgeDocumentSchema.parse({ ...req.body, uploadedBy: userId });
      const doc = await storage.createKnowledgeDocument(data);

      await storage.createWorkspaceMemory({
        category: 'knowledge_base',
        key: `kb_doc_${doc.id}`,
        value: `Document: ${doc.title} (${doc.category}) — File: ${doc.filename}, Type: ${doc.mimeType}${doc.tags ? ', Tags: ' + doc.tags.join(', ') : ''}`,
        source: 'system',
        confidence: 1.0,
      });

      recordUsage({ action: "document_ingested", userId, entityType: "knowledge_document", entityId: String(doc.id) });
      res.status(201).json(doc);
    } catch (e) { next(e); }
  });

  app.patch("/api/knowledge-base/documents/:id", requireAuth, auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: 'knowledge_document' }), async (req, res, next) => {
    try {
      const doc = await storage.getKnowledgeDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ message: "Not found" });
      const user = req.user as Express.User;
      if (doc.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      const data = kbDocPatchSchema.parse(req.body);
      const updated = await storage.updateKnowledgeDocument(Number(req.params.id), data);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/knowledge-base/documents/:id", requireAuth, auditLog({ action: AUDIT_ACTIONS.DELETE, entityType: 'knowledge_document' }), async (req, res, next) => {
    try {
      const doc = await storage.getKnowledgeDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ message: "Not found" });
      const user = req.user as Express.User;
      if (doc.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteKnowledgeDocument(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.get("/api/knowledge-base/search", requireAuth, async (req, res, next) => {
    try {
      const query = String(req.query.q || '').trim();
      if (!query) return res.status(400).json({ message: "Query parameter 'q' required" });
      const results = await storage.searchKnowledgeDocuments(query);
      res.json(results);
    } catch (e) { next(e); }
  });
}
