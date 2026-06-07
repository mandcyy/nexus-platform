import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PrismaClient } from '@prisma/client';

@Module({
  providers: [
    ChatGateway,
    ChatService,
    { provide: PrismaClient, useValue: new PrismaClient() },
  ],
})
export class ChatModule {}