import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInvoice() {
    try {
        const invoice = await prisma.invoice.findFirst({
            where: { invoiceNo: 'INV-YYYYMM-0001' },
            include: {
                invoiceMaterials: true
            }
        });

        if (invoice) {
            console.log('Invoice Details:');
            console.log(`Subtotal: ${invoice.subtotal}`);
            console.log(`Grand Total: ${invoice.grandTotal}`);
            console.log(`CGST: ${invoice.cgst}`);
            console.log(`SGST: ${invoice.sgst}`);
            console.log(`Additional Charges: ${invoice.additionalCharges}`);

            console.log('\nRatio (GrandTotal / Subtotal):', Number(invoice.grandTotal) / Number(invoice.subtotal));

            console.log('\nVerification for 1800 base amount:');
            const calculated = 1800 * (Number(invoice.grandTotal) / Number(invoice.subtotal));
            console.log(`1800 * Ratio = ${calculated}`);
        } else {
            console.log('Invoice not found');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

checkInvoice();
