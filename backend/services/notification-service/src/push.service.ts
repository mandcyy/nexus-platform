import { Injectable } from '@nestjs/common';

@Injectable()
export class PushService {
  async sendToUsers(userIds: string[], notification: any) {
    // Firebase Cloud Messaging (FCM) integration
    console.log(`Push to ${userIds.length} users: ${notification.title}`);
  }

  async sendToUser(userId: string, notification: any) {
    await this.sendToUsers([userId], notification);
  }
}