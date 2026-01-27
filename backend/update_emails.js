import prisma from './src/config/database.js';
import { logger } from './src/utils/logger.js';

/**
 * Update user emails from chemwaste.com to ghmcwest.com
 */
async function updateUserEmails() {
    try {
        logger.info('🔄 Updating user emails...');

        // Update superadmin
        const superadmin = await prisma.user.findUnique({
            where: { email: 'superadmin@chemwaste.com' },
        });
        if (superadmin) {
            await prisma.user.update({
                where: { id: superadmin.id },
                data: { email: 'superadmin@ghmcwest.com' },
            });
            logger.info('✅ Updated superadmin email to superadmin@ghmcwest.com');
        } else {
            logger.warn('⚠️  Superadmin user not found with old email');
        }

        // Update admin
        const admin = await prisma.user.findUnique({
            where: { email: 'admin@chemwaste.com' },
        });
        if (admin) {
            await prisma.user.update({
                where: { id: admin.id },
                data: { email: 'admin@ghmcwest.com' },
            });
            logger.info('✅ Updated admin email to admin@ghmcwest.com');
        } else {
            logger.warn('⚠️  Admin user not found with old email');
        }

        // Update employee
        const employee = await prisma.user.findUnique({
            where: { email: 'employee@chemwaste.com' },
        });
        if (employee) {
            await prisma.user.update({
                where: { id: employee.id },
                data: { email: 'employee@ghmcwest.com' },
            });
            logger.info('✅ Updated employee email to employee@ghmcwest.com');
        } else {
            logger.warn('⚠️  Employee user not found with old email');
        }

        logger.info('🎉 Email update completed!');

        // List all users
        const users = await prisma.user.findMany();
        logger.info('Current users:');
        users.forEach(u => {
            logger.info(`  - ${u.email} (Role: ${u.role})`);
        });

    } catch (error) {
        logger.error('❌ Error updating emails:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateUserEmails();
