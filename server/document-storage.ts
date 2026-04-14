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
import { configResolver } from "./config/resolver.js";

const PROVIDER = process.env.DOCUMENT_STORAGE_PROVIDER || 'local';
const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const DEFAULT_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

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

// ─── S3 PROVIDER (full presigned URL support) ───
class S3StorageProvider implements DocumentStorageProvider {
  private bucket = process.env.S3_BUCKET || '';
  private region = process.env.S3_REGION || 'us-east-1';
  private endpoint = process.env.S3_ENDPOINT || `https://s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com`;

  private async getClient() {
    const { S3Client } = await import('@aws-sdk/client-s3');
    return new S3Client({
      region: this.region,
      ...(this.endpoint && !this.endpoint.includes('amazonaws.com') ? { endpoint: this.endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async generateUploadTarget(entityType: string, entityId: string, filename: string, mimeType: string): Promise<UploadTarget> {
    const key = generateKey(entityType, entityId, filename);
    const client = await this.getClient();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    return {
      key,
      uploadUrl,
      publicUrl: `${this.endpoint}/${this.bucket}/${key}`,
    };
  }

  async generateReadUrl(key: string): Promise<string> {
    const client = await this.getClient();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn: 3600 });
  }

  async deleteObject(key: string): Promise<void> {
    const client = await this.getClient();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    await client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }
}

export function getDocumentStorage(): DocumentStorageProvider {
  if (PROVIDER === 's3' && process.env.S3_BUCKET) {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}

export async function validateUpload(mimeType: string, size: number): Promise<{ valid: boolean; error?: string }> {
  const allowedTypes = await configResolver.getStringArray("media.allowed_mime_types");
  const mimeSet = allowedTypes.length > 0 ? new Set(allowedTypes) : DEFAULT_ALLOWED_MIME_TYPES;
  if (!mimeSet.has(mimeType)) {
    return { valid: false, error: `MIME type '${mimeType}' is not allowed. Accepted: ${[...mimeSet].join(', ')}` };
  }
  const maxFileSize = await configResolver.getNumber("media.max_upload_size_bytes");
  const maxSize = maxFileSize > 0 ? maxFileSize : DEFAULT_MAX_FILE_SIZE;
  if (size > maxSize) {
    return { valid: false, error: `File size ${size} exceeds maximum of ${maxSize} bytes` };
  }
  return { valid: true };
}

export const documentStorage = getDocumentStorage();
export { LOCAL_UPLOAD_DIR };
