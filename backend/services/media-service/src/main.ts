import { NestFactory } from '@nestjs/core';
import { MediaModule } from './media.module';

async function bootstrap() {
  const app = await NestFactory.create(MediaModule);
  app.enableCors();
  await app.listen(process.env.PORT || 3002);
}
bootstrap();