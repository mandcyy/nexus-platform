import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket,
  MessageBody, WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { ChatService } from './chat.service';
import { Logger, UseGuards } from '@nestjs/common';

interface AuthenticatedSocket extends Socket {
  userId: string;
  sessionId: string;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: '*', credentials: true },
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB
  adapter: require('socket.io-redis')({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  }),
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger(ChatGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(private chatService: ChatService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.query.token as string;
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = verify(token, process.env.JWT_SECRET || 'secret') as any;
      client.userId = payload.sub;
      client.sessionId = payload.sessionId;

      // Track online users
      if (!this.userSockets.has(client.userId)) {
        this.userSockets.set(client.userId, new Set());
      }
      this.userSockets.get(client.userId)!.add(client.id);

      // Join personal room
      client.join(`user:${client.userId}`);

      // Broadcast online status
      this.server.emit('presence', { userId: client.userId, status: 'ONLINE' });

      this.logger.log(`User ${client.userId} connected (${this.getOnlineCount()} online)`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;

    const userSocketSet = this.userSockets.get(client.userId);
    if (userSocketSet) {
      userSocketSet.delete(client.id);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(client.userId);
        this.server.emit('presence', {
          userId: client.userId,
          status: 'OFFLINE',
          lastSeen: Date.now(),
        });
      }
    }

    this.logger.log(`User ${client.userId} disconnected`);
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    try {
      const message = await this.chatService.saveMessage({
        ...data,
        senderId: client.userId,
      });

      // Emit to all participants
      this.server.to(`chat:${data.chatId}`).emit('message:new', message);

      // Send push notifications via Kafka
      await this.chatService.notifyParticipants(data.chatId, message, client.userId);

      return { success: true, message };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage('message:edit')
  async handleEdit(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; content: any },
  ) {
    const message = await this.chatService.editMessage(
      data.messageId, client.userId, data.content
    );
    this.server.to(`chat:${message.chatId}`).emit('message:update', {
      messageId: message.id, type: 'edited', content: message.contentJson,
    });
    return { success: true };
  }

  @SubscribeMessage('message:delete')
  async handleDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; forEveryone: boolean },
  ) {
    await this.chatService.deleteMessage(data.messageId, client.userId, data.forEveryone);
    if (data.forEveryone) {
      this.server.emit('message:update', {
        messageId: data.messageId, type: 'deleted',
      });
    }
    return { success: true };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string; isTyping: boolean },
  ) {
    client.to(`chat:${data.chatId}`).emit('typing', {
      chatId: data.chatId,
      userId: client.userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('chat:join')
  handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    client.join(`chat:${data.chatId}`);
    this.logger.debug(`${client.userId} joined chat:${data.chatId}`);
  }

  @SubscribeMessage('chat:leave')
  handleLeaveChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    client.leave(`chat:${data.chatId}`);
  }

  @SubscribeMessage('read:receipt')
  handleReadReceipt(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string; messageId: string },
  ) {
    this.chatService.markRead(data.chatId, client.userId, data.messageId);
    client.to(`chat:${data.chatId}`).emit('read:receipt', {
      chatId: data.chatId, userId: client.userId, messageId: data.messageId,
    });
  }

  @SubscribeMessage('reaction:add')
  async handleReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    await this.chatService.addReaction(data.messageId, client.userId, data.emoji);
    this.server.emit('reaction', {
      messageId: data.messageId, userId: client.userId, emoji: data.emoji,
    });
  }

  getOnlineCount(): number {
    return this.userSockets.size;
  }

  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size || 0) > 0;
  }
}