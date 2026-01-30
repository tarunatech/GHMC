import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    fs.writeFileSync('users_json.txt', JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}

main().catch(console.error);
