import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { MinioService } from './minio.service';
import { TranscodeService } from './transcode.service';
import { v4 as uuid } from 'uuid';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class MediaService {
  async upload(file: Express.Multer.File, type: string) {
    const id = uuid();
    const ext = file.originalname.split('.').pop();
    const objectName = `${type}/${id}.${ext}`;

    await this.minio.upload('media', objectName, file.buffer, file.mimetype);

    // Generate thumbnails async
    setTimeout(async () => {
      const thumbs = await this.transcode.generateThumbnails(file.buffer, file.mimetype);
      for (const [size, buffer] of Object.entries(thumbs)) {
        await this.minio.upload('thumbnails', `${objectName}_${size}`, buffer, 'image/jpeg');
      }
    }, 0);

    return { id, url: `/media/${id}`, type, size: file.size, mimeType: file.mimetype };
  }

  async getMedia(id: string) {
    const buffer = await this.minio.getObject('media', `uploads/${id}`);
    return { buffer, contentType: 'application/octet-stream' };
  }

  async getThumbnail(id: string, size: number) {
    try {
      return await this.minio.getObject('thumbnails', `uploads/${id}_${size}`);
    } catch {
      return await this.minio.getObject('thumbnails', `uploads/${id}_256`);
    }
  }

  async getDownloadUrl(id: string, quality?: string) {
    return { url: await this.minio.getPresignedUrl('media', `uploads/${id}`) };
  }

  constructor(
    private minio: MinioService,
    private transcode: TranscodeService,
    @Inject('KAFKA_SERVICE') private kafka: ClientKafka,
  ) {}
}