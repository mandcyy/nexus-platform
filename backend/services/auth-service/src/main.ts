import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as helmet from 'helmet';
import * as prometheus from 'prom-client';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create HTTP + gRPC hybrid app
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet.default());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Metrics
  prometheus.collectDefaultMetrics({ prefix: 'nexus_auth_' });

  // gRPC Microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'nexus.auth',
      protoPath: `${__dirname}/../proto/auth.proto`,
      url: `0.0.0.0:${process.env.GRPC_PORT || 50051}`,
    },
  });

  // Kafka Consumer (for inter-service events)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      },
      consumer: {
        groupId: 'auth-service',
      },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Auth service running on :${port}`);
  logger.log(`gRPC on :${process.env.GRPC_PORT || 50051}`);
}

bootstrap();