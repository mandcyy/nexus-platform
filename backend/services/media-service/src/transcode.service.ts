import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { v4 as uuid } from 'uuid';

@Injectable()
export class TranscodeService {
  private logger = new Logger(TranscodeService.name);

  async generateThumbnails(buffer: Buffer, mimeType: string): Promise<Record<string, Buffer>> {
    const thumbnails: Record<string, Buffer> = {};

    if (mimeType.startsWith('image/')) {
      for (const size of [64, 256, 512, 1024]) {
        thumbnails[`${size}`] = await sharp(buffer)
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
      }
    } else if (mimeType.startsWith('video/')) {
      // Video thumbnail via ffmpeg
      thumbnails['video_thumb'] = await this.generateVideoThumbnail(buffer);
    }

    return thumbnails;
  }

  async optimizeImage(buffer: Buffer): Promise<{ webp: Buffer; jpeg: Buffer; avif: Buffer }> {
    const [webp, jpeg, avif] = await Promise.all([
      sharp(buffer).webp({ quality: 80 }).toBuffer(),
      sharp(buffer).jpeg({ quality: 85, progressive: true }).toBuffer(),
      sharp(buffer).avif({ quality: 70 }).toBuffer(),
    ]);
    return { webp, jpeg, avif };
  }

  private async generateVideoThumbnail(buffer: Buffer): Promise<Buffer> {
    // FFmpeg-based video thumbnail extraction
    // Simplified — in production use fluent-ffmpeg
    this.logger.log('Generating video thumbnail');
    return Buffer.from([]);
  }

  createUploadId(): string { return uuid(); }
}