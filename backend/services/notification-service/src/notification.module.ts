import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { NotificationController } from './notification.controller';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, PushService, EmailService, SmsService],
})
export class NotificationModule {}