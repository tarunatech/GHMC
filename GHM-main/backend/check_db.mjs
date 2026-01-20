
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function checkLatestInvoice() {
    try {
        console.log('--- DB DIAGNOSTIC ESM START ---');
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
        console.log('--- DB DIAGNOSTIC ESM END ---');
    } catch (error) {
        console.error('DIAGNOSTIC ERROR:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLatestInvoice();
