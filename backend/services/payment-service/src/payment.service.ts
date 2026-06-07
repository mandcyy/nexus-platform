import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentService {
  async createPayment(userId: string, amount: number, currency: string) {
    return { paymentId: 'pay_xxx', amount, currency, status: 'pending' };
  }

  async processPayment(paymentId: string) {
    return { paymentId, status: 'completed' };
  }

  async refund(paymentId: string) { return { paymentId, status: 'refunded' }; }
}