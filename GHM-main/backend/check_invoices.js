import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInvoices() {
    try {
        const invoices = await prisma.invoice.findMany({
            select: {
                id: true,
                type: true,
            }
        });

        console.log('All Invoice types:', invoices.map(i => i.type));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

checkInvoices();
