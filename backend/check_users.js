
import prisma from './src/config/database.js';

async function checkUsers() {
    try {
        const users = await prisma.user.findMany();
        console.log('Users found:', users.length);
        users.forEach(u => {
            console.log(`- ${u.email} (Role: ${u.role}, Active: ${u.isActive})`);
        });
    } catch (error) {
        console.error('Error checking users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUsers();
