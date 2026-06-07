import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MinioService } from './minio.service';
import { TranscodeService } from './transcode.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([{
      name: 'KAFKA_SERVICE',
      transport: Transport.KAFKA,
      options: {
        client: { brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') },
        consumer: { groupId: 'media-service' },
      },
    }]),
  ],
  controllers: [MediaController],
  providers: [MediaService, MinioService, TranscodeService],
})
export class MediaModule {}