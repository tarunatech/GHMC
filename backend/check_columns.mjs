
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function checkColumns() {
    try {
        console.log('--- DB COLUMNS CHECK START ---');
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invoices'
    `;
        console.log('COLUMNS:', JSON.stringify(columns, null, 2));
        console.log('--- DB COLUMNS CHECK END ---');
    } catch (error) {
        console.error('COLUMNS CHECK ERROR:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkColumns();
