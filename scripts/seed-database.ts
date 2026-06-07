// Database seeding script for Nexus Platform
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create system user
  const adminPassword = await bcrypt.hash('Admin123!@#', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'nexus_admin' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      username: 'nexus_admin',
      email: 'admin@nexus-platform.com',
      passwordHash: adminPassword,
      displayName: 'Nexus Admin',
      role: 'ADMIN',
      isVerified: true,
    },
  });

  // Create demo users
  for (let i = 1; i <= 100; i++) {
    await prisma.user.upsert({
      where: { username: `user_${i}` },
      update: {},
      create: {
        username: `user_${i}`,
        email: `user${i}@example.com`,
        passwordHash: await bcrypt.hash('password123', 12),
        displayName: `User ${i}`,
        status: i % 5 === 0 ? 'ONLINE' : 'OFFLINE',
        level: Math.floor(Math.random() * 50) + 1,
        xp: Math.floor(Math.random() * 100000),
      },
    });
  }

  // Create system channel
  await prisma.chat.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      type: 'BROADCAST_CHANNEL',
      name: 'Nexus Announcements',
      description: 'Official announcements from Nexus Platform',
    },
  });

  console.log('Seed complete!');
  console.log(`Admin: admin@nexus-platform.com / Admin123!@#`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
