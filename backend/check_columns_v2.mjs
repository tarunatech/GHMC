
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function checkColumns() {
    try {
        const columns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'invoices'
      AND column_name IN ('additional_charges_quantity', 'additional_charges_rate', 'additional_charges_unit')
    `;
        console.log('MISSING COLUMNS CHECK Result:', columns);
    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkColumns();
