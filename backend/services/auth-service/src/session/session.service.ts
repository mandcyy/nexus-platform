import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async createSession(data: any) {
    return this.prisma.session.create({ data });
  }

  async getSession(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isRevoked: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(id: string) {
    return this.prisma.session.update({
      where: { id },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string) {
    return this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async revokeSessionsForDevice(userId: string, deviceId: string) {
    return this.prisma.session.updateMany({
      where: { userId, deviceId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }
}