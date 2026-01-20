
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLatestInvoice() {
    try {
        console.log('--- DB DIAGNOSTIC START ---');
        const invoice = await prisma.invoice.findFirst({
            orderBy: { createdAt: 'desc' },
        });

        if (!invoice) {
            console.log('No invoices found.');
        } else {
            console.log('LATEST INVOICE FOUND:', invoice.invoiceNo);
            console.log('DATA:', JSON.stringify({
                additionalCharges: invoice.additionalCharges,
                additionalChargesDescription: invoice.additionalChargesDescription,
                additionalChargesQuantity: invoice.additionalChargesQuantity,
                additionalChargesRate: invoice.additionalChargesRate,
                additionalChargesUnit: invoice.additionalChargesUnit
            }, null, 2));
        }
        console.log('--- DB DIAGNOSTIC END ---');
    } catch (error) {
        console.error('DIAGNOSTIC ERROR:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLatestInvoice();
