import { Module } from '@nestjs/common';
import { TwoFactorService } from './2fa.service';

@Module({
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}