import { Client } from 'minio';

// MinIO is the self-hosted object store (APPROACH.md §8) — Express is the
// only thing that talks to it directly, same internal-only pattern as
// Postgres (§6). Modules call uploadPublicFile(); nothing outside this
// file touches the MinIO client.
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'app',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'apppassword',
});

const BUCKET = process.env.MINIO_BUCKET ?? 'multi-purpose-uploads';
// Public URL base the browser can actually load objects from — distinct
// from the internal endpoint above, since MinIO needs its own exposed
// port/subdomain to be browser-reachable (APPROACH.md §8's last bullet).
const PUBLIC_URL_BASE = process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000';

export async function uploadPublicFile(
  objectName: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  return `${PUBLIC_URL_BASE}/${BUCKET}/${objectName}`;
}

// Private objects (APPROACH.md §8: "future modules needing private file
// storage would use presigned URLs instead of a public policy"). A tailored
// resume is personal data, so unlike an avatar it must never be public-read.
// No bucket policy is involved: the object is simply never readable without a
// signed URL, which is why the caller stores the OBJECT NAME and asks for a
// fresh URL each time rather than persisting one.
export async function uploadPrivateFile(
  objectName: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  return objectName;
}

// Short-lived by design. Long enough to click a download, short enough that a
// URL copied out of a browser history is useless later.
const PRESIGNED_TTL_SECONDS = 15 * 60;

export async function presignedGetUrl(
  objectName: string,
  downloadFileName?: string,
): Promise<string> {
  // Content-Disposition is set at sign time, so the browser saves
  // "resume.pdf" rather than the opaque object key.
  const reqParams = downloadFileName
    ? { 'response-content-disposition': `attachment; filename="${downloadFileName.replace(/[^\w.-]/g, '_')}"` }
    : undefined;
  return minioClient.presignedGetObject(BUCKET, objectName, PRESIGNED_TTL_SECONDS, reqParams);
}

// Reads a private object back. Used when a stored base resume has to be sent
// on to the generator: the bytes live in MinIO, not in the request, and the
// generator only speaks multipart.
export async function getFile(objectName: string): Promise<Buffer> {
  const stream = await minioClient.getObject(BUCKET, objectName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function removeFile(objectName: string): Promise<void> {
  await minioClient.removeObject(BUCKET, objectName);
}
