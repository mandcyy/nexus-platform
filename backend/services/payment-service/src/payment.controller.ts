import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private payment: PaymentService) {}

  @Post()
  async create(@Body() dto: any) {
    return this.payment.createPayment(dto.userId, dto.amount, dto.currency);
  }

  @Post(':id/process')
  async process(@Param('id') id: string) {
    return this.payment.processPayment(id);
  }

  @Post(':id/refund')
  async refund(@Param('id') id: string) {
    return this.payment.refund(id);
  }
}