import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AiModule } from './ai.module';

async function bootstrap() {
  const app = await NestFactory.create(AiModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') },
      consumer: { groupId: 'ai-service' },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3004);
}
bootstrap();