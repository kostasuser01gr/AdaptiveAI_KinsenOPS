/**
 * Document Storage Abstraction — S3/R2-compatible with local fallback.
 * 
 * Environment variables:
 *   DOCUMENT_STORAGE_PROVIDER: "s3" | "local" (default: "local")
 *   S3_BUCKET: bucket name
 *   S3_REGION: AWS region (default: "us-east-1")
 *   S3_ENDPOINT: custom endpoint for R2/MinIO
 *   S3_ACCESS_KEY_ID: AWS access key
 *   S3_SECRET_ACCESS_KEY: AWS secret key
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

const PROVIDER = process.env.DOCUMENT_STORAGE_PROVIDER || 'local';
const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export interface UploadTarget {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

export interface DocumentStorageProvider {
  generateUploadTarget(entityType: string, entityId: string, filename: string, mimeType: string): Promise<UploadTarget>;
  generateReadUrl(key: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

function generateKey(entityType: string, entityId: string, filename: string): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(6).toString('hex');
  const safe = sanitizeFilename(filename);
  return `${entityType}/${entityId}/${ts}-${rand}-${safe}`;
}

// ─── LOCAL PROVIDER ───
class LocalStorageProvider implements DocumentStorageProvider {
  async generateUploadTarget(entityType: string, entityId: string, filename: string, _mimeType: string): Promise<UploadTarget> {
    const key = generateKey(entityType, entityId, filename);
    const dir = path.join(LOCAL_UPLOAD_DIR, entityType, entityId);
    await fs.mkdir(dir, { recursive: true });
    return {
      key,
      uploadUrl: `/api/documents/upload/${encodeURIComponent(key)}`,
      publicUrl: `/api/documents/read/${encodeURIComponent(key)}`,
    };
  }
  async generateReadUrl(key: string): Promise<string> {
    return `/api/documents/read/${encodeURIComponent(key)}`;
  }
  async deleteObject(key: string): Promise<void> {
    const filepath = path.join(LOCAL_UPLOAD_DIR, key);
    await fs.unlink(filepath).catch(() => {});
  }
}

// ─── S3 PROVIDER (presigned URL generation without full AWS SDK) ───
class S3StorageProvider implements DocumentStorageProvider {
  private bucket = process.env.S3_BUCKET || '';
  private region = process.env.S3_REGION || 'us-east-1';
  private endpoint = process.env.S3_ENDPOINT || `https://s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com`;

  async generateUploadTarget(entityType: string, entityId: string, filename: string, _mimeType: string): Promise<UploadTarget> {
    const key = generateKey(entityType, entityId, filename);
    // In production, use AWS SDK v3 to generate presigned PUT URL
    // For now, return the API proxy path — the actual S3 presigned URL generation
    // requires @aws-sdk/s3-request-presigner which can be added when S3_BUCKET is configured
    return {
      key,
      uploadUrl: `/api/documents/upload/${encodeURIComponent(key)}`,
      publicUrl: `${this.endpoint}/${this.bucket}/${key}`,
    };
  }
  async generateReadUrl(key: string): Promise<string> {
    // When AWS SDK is available, generate presigned GET URL
    return `/api/documents/read/${encodeURIComponent(key)}`;
  }
  async deleteObject(key: string): Promise<void> {
    // When AWS SDK is available, call DeleteObject
    const filepath = path.join(LOCAL_UPLOAD_DIR, key);
    await fs.unlink(filepath).catch(() => {});
  }
}

export function getDocumentStorage(): DocumentStorageProvider {
  if (PROVIDER === 's3' && process.env.S3_BUCKET) {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}

export function validateUpload(mimeType: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `MIME type '${mimeType}' is not allowed. Accepted: ${[...ALLOWED_MIME_TYPES].join(', ')}` };
  }
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size ${size} exceeds maximum of ${MAX_FILE_SIZE} bytes` };
  }
  return { valid: true };
}

export const documentStorage = getDocumentStorage();
export { LOCAL_UPLOAD_DIR };
