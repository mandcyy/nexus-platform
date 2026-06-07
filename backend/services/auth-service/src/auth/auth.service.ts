import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { DeviceService } from '../device/device.service';
import { TwoFactorService } from '../2fa/2fa.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
    private deviceService: DeviceService,
    private twoFactorService: TwoFactorService,
    private cryptoService: CryptoService,
  ) {}

  async register(dto: RegisterDto) {
    // Check unique constraints
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          { email: dto.email },
          { phone: dto.phone },
        ].filter(Boolean),
      },
    });

    if (existing) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        id: uuid(),
        username: dto.username,
        email: dto.email,
        phone: dto.phone,
        passwordHash: hashedPassword,
        displayName: dto.displayName,
      },
    });

    // Generate E2EE keys
    await this.cryptoService.generateKeyBundle(user.id);

    return this.createAuthResponse(user, dto.deviceInfo);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.identifier },
          { email: dto.identifier },
          { phone: dto.identifier },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check 2FA
    if (user.totpEnabled || user.otpEnabled) {
      if (!dto.totpCode && !dto.otpCode && !dto.recoveryCode) {
        return { requires2fa: true, userId: user.id };
      }

      if (dto.recoveryCode) {
        await this.twoFactorService.verifyRecoveryCode(user.id, dto.recoveryCode);
      } else if (dto.totpCode) {
        await this.twoFactorService.verifyTotp(user.id, dto.totpCode);
      } else if (dto.otpCode) {
        await this.twoFactorService.verifyOtp(user.id, dto.otpCode);
      } else {
        throw new UnauthorizedException('2FA code required');
      }
    }

    // Device registration & approval
    const deviceApproval = await this.deviceService.registerDevice(
      user.id, dto.deviceInfo
    );

    return this.createAuthResponse(user, dto.deviceInfo);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const session = await this.sessionService.getSession(payload.sessionId);
      if (!session || session.isRevoked) {
        throw new UnauthorizedException('Session revoked');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) throw new UnauthorizedException('User not found');

      // Rotate refresh token
      await this.sessionService.revokeSession(payload.sessionId);

      return this.createAuthResponse(user, { deviceId: session.deviceId });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(sessionId: string, allDevices: boolean, userId: string) {
    if (allDevices) {
      await this.sessionService.revokeAllSessions(userId);
    } else {
      await this.sessionService.revokeSession(sessionId);
    }
  }

  async checkAvailability(field: string, value: string): Promise<boolean> {
    const where: any = {};
    where[field] = value;
    const exists = await this.prisma.user.findFirst({ where });
    return !exists;
  }

  async sendOtp(destination: string, method: 'sms' | 'email') {
    await this.twoFactorService.sendOtp(destination, method);
    return { expiresIn: 300, attemptRemaining: 5 };
  }

  async verifyOtp(destination: string, code: string, deviceInfo: any) {
    const userId = await this.twoFactorService.verifyOtpCode(destination, code);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.createAuthResponse(user, deviceInfo);
  }

  async getUserDevices(userId: string) {
    return this.deviceService.getUserDevices(userId);
  }

  async revokeDevice(userId: string, deviceId: string) {
    await this.deviceService.revokeDevice(userId, deviceId);
    await this.sessionService.revokeSessionsForDevice(userId, deviceId);
  }

  async getSessions(userId: string) {
    return this.sessionService.getSessions(userId);
  }

  private async createAuthResponse(user: any, deviceInfo?: any): Promise<AuthResponse> {
    const sessionId = uuid();

    const accessToken = this.jwtService.sign({
      sub: user.id,
      sessionId,
      role: user.role,
    }, { expiresIn: '15m' });

    const refreshToken = this.jwtService.sign({
      sub: user.id,
      sessionId,
    }, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });

    await this.sessionService.createSession({
      id: sessionId,
      userId: user.id,
      deviceId: deviceInfo?.deviceId,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      sessionId,
      requires2fa: false,
      deviceApprovalRequired: false,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        status: user.status,
        lastSeen: user.lastSeen,
        isVerified: user.isVerified,
        level: user.level,
        xp: user.xp,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }
}

// Types
interface RegisterDto {
  username?: string; email?: string; phone?: string;
  password: string; displayName: string; deviceInfo: any;
}

interface LoginDto {
  identifier: string; password: string;
  totpCode?: string; otpCode?: string; recoveryCode?: string;
  deviceInfo: any;
}

interface AuthResponse {
  accessToken: string; refreshToken: string; expiresIn: number;
  sessionId: string; requires2fa: boolean; deviceApprovalRequired: boolean;
  user: any;
}