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
