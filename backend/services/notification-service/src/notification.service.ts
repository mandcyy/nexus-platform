import { Injectable, Logger } from '@nestjs/common';
import { PushService } from './push.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

@Injectable()
export class NotificationService {
  private logger = new Logger(NotificationService.name);

  constructor(
    private push: PushService,
    private email: EmailService,
    private sms: SmsService,
  ) {}

  async sendMessageNotification(recipientIds: string[], message: any, chatName: string, senderId: string) {
    await this.push.sendToUsers(recipientIds, {
      title: chatName || 'New Message',
      body: truncate(getPreview(message), 100),
      data: { type: 'message', chatId: message.chatId, messageId: message.id },
    });
  }

  async sendCallNotification(recipientIds: string[], callData: any) {
    await this.push.sendToUsers(recipientIds, {
      title: 'Incoming Call',
      body: `${callData.callerName} is calling...`,
      data: { type: 'call', callId: callData.callId, isVideo: String(callData.isVideo) },
      priority: 'high',
      ttl: 60000,
    });
  }

  async sendSecurityAlert(userId: string, alert: string) {
    await this.email.send(userId, 'Security Alert - Nexus Platform', alert);
  }

  async sendOtp(destination: string, method: 'sms' | 'email', code: string) {
    if (method === 'sms') await this.sms.send(destination, `Your Nexus code: ${code}`);
    else await this.email.sendRaw(destination, 'Verification Code', `Your code: ${code}`);
  }
}

function getPreview(msg: any): string {
  try { return JSON.parse(msg.contentJson)?.text || 'Media'; }
  catch { return 'New message'; }
}

function truncate(text: string, len: number): string {
  return text.length > len ? text.substring(0, len - 3) + '...' : text;
}