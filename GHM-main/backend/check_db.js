const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLatestInvoice() {
    try {
        const invoice = await prisma.invoice.findFirst({
            orderBy: { createdAt: 'desc' },
            select: {
                invoiceNo: true,
                additionalCharges: true,
                additionalChargesDescription: true,
                additionalChargesQuantity: true,
                additionalChargesRate: true,
                additionalChargesUnit: true,
                createdAt: true
            }
        });

        console.log('LATEST INVOICE:', JSON.stringify(invoice, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLatestInvoice();
