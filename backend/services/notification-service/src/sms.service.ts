import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
  async send(phone: string, message: string) {
    // Twilio integration
    console.log(`SMS to ${phone}: ${message}`);
  }
}