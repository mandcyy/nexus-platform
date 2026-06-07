import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ChatModule } from './chat.module';

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);

  // Kafka consumer for inter-service events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') },
      consumer: { groupId: 'chat-service' },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3001);
}

bootstrap();