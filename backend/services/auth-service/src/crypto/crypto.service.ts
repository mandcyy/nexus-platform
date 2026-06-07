import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CryptoService {
  constructor(private prisma: PrismaService) {}

  async generateKeyBundle(userId: string) {
    // Generate Signal Protocol key pairs (server-side key distribution)
    const identityKeyPair = crypto.generateKeyPairSync('x25519');
    const signedPreKeyPair = crypto.generateKeyPairSync('x25519');
    const signedPreKeyId = crypto.randomInt(0, 0xFFFF);
    const registrationId = crypto.randomInt(0, 0x3FFF);

    // Store identity key
    await this.prisma.keyBundle.upsert({
      where: { userId },
      update: {
        identityKey: identityKeyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        signedPreKey: signedPreKeyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        signedPreKeyId,
        registrationId,
      },
      create: {
        id: uuid(),
        userId,
        identityKey: identityKeyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        signedPreKey: signedPreKeyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        signedPreKeyId,
        registrationId,
      },
    });

    // Generate 100 one-time pre-keys
    const oneTimePreKeys = Array.from({ length: 100 }, () => ({
      id: uuid(),
      userId,
      keyId: crypto.randomInt(0, 0xFFFFFF),
      publicKey: crypto.generateKeyPairSync('x25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      isUsed: false,
    }));

    await this.prisma.oneTimePreKey.createMany({ data: oneTimePreKeys });

    return { success: true };
  }

  async uploadKeyBundle(userId: string, bundle: any) {
    await this.prisma.keyBundle.upsert({
      where: { userId },
      update: {
        identityKey: bundle.identityKey,
        signedPreKey: bundle.signedPreKey.publicKey,
        signedPreKeyId: bundle.signedPreKey.id,
        registrationId: bundle.registrationId,
      },
      create: {
        id: uuid(),
        userId,
        identityKey: bundle.identityKey,
        signedPreKey: bundle.signedPreKey.publicKey,
        signedPreKeyId: bundle.signedPreKey.id,
        registrationId: bundle.registrationId,
      },
    });

    // Add one-time pre-keys
    if (bundle.oneTimePreKeys?.length) {
      await this.prisma.oneTimePreKey.createMany({
        data: bundle.oneTimePreKeys.map((pk: any) => ({
          id: uuid(),
          userId,
          keyId: pk.id,
          publicKey: pk.publicKey,
          isUsed: false,
        })),
      });
    }
  }

  async getKeyBundle(userId: string): Promise<any> {
    const bundle = await this.prisma.keyBundle.findUnique({ where: { userId } });
    if (!bundle) return null;

    const oneTimePreKey = await this.prisma.oneTimePreKey.findFirst({
      where: { userId, isUsed: false },
      orderBy: { createdAt: 'asc' },
    });

    if (oneTimePreKey) {
      await this.prisma.oneTimePreKey.update({
        where: { id: oneTimePreKey.id },
        data: { isUsed: true },
      });
    }

    return {
      userId,
      identityKey: bundle.identityKey,
      signedPreKey: {
        id: bundle.signedPreKeyId,
        publicKey: bundle.signedPreKey,
        signature: '', // signature comes from client
      },
      oneTimePreKey: oneTimePreKey ? {
        id: oneTimePreKey.keyId,
        publicKey: oneTimePreKey.publicKey,
      } : null,
      registrationId: bundle.registrationId,
    };
  }

  async getOneTimePreKeyCount(userId: string): Promise<number> {
    return this.prisma.oneTimePreKey.count({
      where: { userId, isUsed: false },
    });
  }
}