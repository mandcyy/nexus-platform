import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { v4 as uuid } from 'uuid';

@Injectable()
export class TwoFactorService {
  private otpStore = new Map<string, { code: string; userId: string; expiresAt: number }>();

  constructor(private prisma: PrismaService) {}

  async setupTotp(userId: string) {
    const secret = speakeasy.generateSecret({
      name: `Nexus:${userId}`,
      issuer: 'Nexus Platform',
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret.base32 },
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    await this.prisma.recoveryCode.createMany({
      data: backupCodes.map(code => ({
        id: uuid(), userId, code: code, isUsed: false,
      })),
    });

    return { secret: secret.base32, qrCodeUrl: qrCode, backupCodes };
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('TOTP not configured');

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) throw new BadRequestException('Invalid TOTP code');
    return true;
  }

  async sendOtp(destination: string, method: 'sms' | 'email'): Promise<void> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${method}:${destination}`;
    this.otpStore.set(key, { code, userId: '', expiresAt: Date.now() + 300000 });

    if (method === 'sms') {
      // Twilio integration
      console.log(`SMS OTP to ${destination}: ${code}`);
    } else {
      // SendGrid/nodemailer integration
      console.log(`Email OTP to ${destination}: ${code}`);
    }
  }

  async verifyOtpCode(destination: string, code: string): Promise<string> {
    const keys = [`sms:${destination}`, `email:${destination}`];
    for (const key of keys) {
      const stored = this.otpStore.get(key);
      if (stored && stored.code === code && stored.expiresAt > Date.now()) {
        this.otpStore.delete(key);
        return stored.userId || destination;
      }
    }
    throw new BadRequestException('Invalid or expired OTP');
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<void> {
    const rc = await this.prisma.recoveryCode.findFirst({
      where: { userId, code, isUsed: false },
    });
    if (!rc) throw new BadRequestException('Invalid recovery code');

    await this.prisma.recoveryCode.update({
      where: { id: rc.id },
      data: { isUsed: true, usedAt: new Date() },
    });
  }

  async generateRecoveryCodes(userId: string) {
    await this.prisma.recoveryCode.updateMany({
      where: { userId, isUsed: false },
      data: { isUsed: true },
    });

    const codes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    await this.prisma.recoveryCode.createMany({
      data: codes.map(code => ({
        id: uuid(), userId, code, isUsed: false,
      })),
    });

    return codes;
  }
}