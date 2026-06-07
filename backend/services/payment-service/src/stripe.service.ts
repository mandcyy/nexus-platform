import { Injectable } from '@nestjs/common';

@Injectable()
export class StripeService {
  async createPaymentIntent(amount: number, currency: string) {
    return { clientSecret: 'pi_xxx_secret_xxx' };
  }
}