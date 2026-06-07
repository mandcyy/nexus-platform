import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationModule } from './notification.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') },
      consumer: { groupId: 'notification-service' },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3005);
}
bootstrap();