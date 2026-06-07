import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private client: Minio.Client;
  private logger = new Logger(MinioService.name);

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'minio',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'nexus_minio',
      secretKey: process.env.MINIO_SECRET_KEY || 'nexus-minio-secret',
    });
    this.ensureBuckets();
  }

  private async ensureBuckets() {
    for (const bucket of ['media', 'avatars', 'stories', 'thumbnails', 'files']) {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) await this.client.makeBucket(bucket, 'us-east-1');
    }
  }

  async upload(bucket: string, objectName: string, buffer: Buffer, contentType: string) {
    return this.client.putObject(bucket, objectName, buffer, buffer.length, { 'Content-Type': contentType });
  }

  async uploadChunk(bucket: string, uploadId: string, partNumber: number, chunk: Buffer) {
    // Multipart upload
    this.logger.log(`Uploading chunk ${partNumber} for ${uploadId}`);
  }

  async getPresignedUrl(bucket: string, objectName: string, expiry = 3600) {
    return this.client.presignedGetObject(bucket, objectName, expiry);
  }

  async getObject(bucket: string, objectName: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, objectName);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteObject(bucket: string, objectName: string) {
    return this.client.removeObject(bucket, objectName);
  }
}