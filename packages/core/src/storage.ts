import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Thin wrapper around the S3-compatible object store (adobe/s3mock locally,
 * swap for real MinIO/S3 in prod via env). Files never live in Postgres —
 * only the storage key and sha256 do.
 */

let client: S3Client | null = null;

function getClient(): S3Client {
  client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "sift",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "siftsiftsift",
    },
  });
  return client;
}

function bucket(): string {
  return process.env.S3_BUCKET ?? "sift-packages";
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string): Promise<Uint8Array> {
  const s3 = getClient();
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error(`empty object body for key ${key}`);
  }
  return bytes;
}
