import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const counts = {
        users: await prisma.user.count(),
        companies: await prisma.company.count(),
        transporters: await prisma.transporter.count(),
        invoices: await prisma.invoice.count(),
        inwardEntries: await prisma.inwardEntry.count(),
        outwardEntries: await prisma.outwardEntry.count(),
    };
    console.log('Data counts:', counts);
    await prisma.$disconnect();
}

main().catch(console.error);
