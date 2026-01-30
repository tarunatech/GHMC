import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
    const email = 'taruna@gmail.com';
    const password = 'admin'; // Testing common simple password

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log('User already exists');
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
        data: {
            email,
            passwordHash,
            role: 'admin',
            fullName: 'Taruna Admin',
            isActive: true
        }
    });
    console.log(`Created user ${email} with password ${password}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
