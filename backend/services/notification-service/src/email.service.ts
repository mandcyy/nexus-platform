import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async send(userId: string, subject: string, body: string) {
    // SendGrid / Nodemailer integration
    console.log(`Email to ${userId}: ${subject}`);
  }

  async sendRaw(email: string, subject: string, body: string) {
    console.log(`Email to ${email}: ${subject}`);
  }
}