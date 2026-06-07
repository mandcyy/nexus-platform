import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { Kafka } from 'kafkajs';

@Injectable()
export class ChatService {
  private logger = new Logger(ChatService.name);
  private kafka: Kafka;
  private producer: any;

  constructor(private prisma: PrismaClient) {
    this.kafka = new Kafka({
      clientId: 'chat-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });
    this.producer = this.kafka.producer();
    this.producer.connect();
  }

  async saveMessage(data: {
    id?: string; chatId: string; senderId: string;
    contentType: string; contentJson: string; replyTo?: string;
  }) {
    const message = await this.prisma.message.create({
      data: {
        id: data.id || uuid(),
        chatId: data.chatId,
        senderId: data.senderId,
        contentType: data.contentType,
        contentJson: data.contentJson,
        replyTo: data.replyTo,
        status: 'SENT',
      },
    });

    // Update chat's last message
    await this.prisma.chat.update({
      where: { id: data.chatId },
      data: { updatedAt: new Date() },
    });

    // Publish to Kafka for notification service
    await this.producer.send({
      topic: 'chat.messages',
      messages: [{
        key: data.chatId,
        value: JSON.stringify(message),
      }],
    });

    return message;
  }

  async editMessage(messageId: string, userId: string, content: any) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.senderId !== userId) throw new Error('Unauthorized');

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        contentJson: JSON.stringify(content),
        isEdited: true,
        editedAt: new Date(),
      },
    });
  }

  async deleteMessage(messageId: string, userId: string, forEveryone: boolean) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.senderId !== userId) throw new Error('Unauthorized');

    if (forEveryone) {
      return this.prisma.message.update({
        where: { id: messageId },
        data: { status: 'DELETED' },
      });
    }
  }

  async markRead(chatId: string, userId: string, messageId: string) {
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadMessageId: messageId },
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    await this.prisma.reaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      update: {},
      create: { id: uuid(), messageId, userId, emoji },
    });
  }

  async notifyParticipants(chatId: string, message: any, senderId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) return;

    const recipientIds = chat.participants
      .map(p => p.userId)
      .filter(id => id !== senderId);

    await this.producer.send({
      topic: 'notifications.push',
      messages: [{
        key: chatId,
        value: JSON.stringify({
          recipientIds,
          message,
          chatId,
          chatName: chat.name,
          senderId,
        }),
      }],
    });
  }

  async getMessages(chatId: string, limit = 50, before?: string) {
    const where: any = { chatId, status: { not: 'DELETED' } };
    if (before) where.createdAt = { lt: new Date(before) };

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { reactions: true },
    });
  }
}