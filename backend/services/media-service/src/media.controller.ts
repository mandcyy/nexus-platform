import { Controller, Post, Get, Param, Query, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { Response } from 'express';

@Controller('media')
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Query('type') type: string) {
    return this.mediaService.upload(file, type);
  }

  @Get(':id')
  async getMedia(@Param('id') id: string, @Res() res: Response) {
    const { buffer, contentType } = await this.mediaService.getMedia(id);
    res.set('Content-Type', contentType);
    res.send(buffer);
  }

  @Get(':id/thumbnail')
  async getThumbnail(@Param('id') id: string, @Query('size') size: number, @Res() res: Response) {
    const buffer = await this.mediaService.getThumbnail(id, size || 256);
    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Query('quality') quality: string) {
    return this.mediaService.getDownloadUrl(id, quality);
  }
}