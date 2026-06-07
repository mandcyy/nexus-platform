import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(userId: string, info: any) {
    const existing = await this.prisma.device.findFirst({
      where: { userId, deviceId: info.deviceId },
    });

    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          lastActive: new Date(),
          pushToken: info.pushToken,
        },
      });
    }

    return this.prisma.device.create({
      data: {
        id: `${userId}_${info.deviceId}`,
        userId,
        deviceId: info.deviceId,
        deviceName: info.deviceName || 'Unknown Device',
        osVersion: info.osVersion,
        appVersion: info.appVersion,
        fingerprint: info.fingerprint,
        pushToken: info.pushToken,
        isTrusted: true,
        firstSeen: new Date(),
        lastActive: new Date(),
      },
    });
  }

  async getUserDevices(userId: string) {
    return this.prisma.device.findMany({
      where: { userId, isRevoked: false },
      orderBy: { lastActive: 'desc' },
    });
  }

  async revokeDevice(userId: string, deviceId: string) {
    return this.prisma.device.updateMany({
      where: { userId, deviceId, isRevoked: false },
      data: { isRevoked: true },
    });
  }
}