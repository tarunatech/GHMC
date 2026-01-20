import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Seed superadmin user
 * Run this once to create the superadmin user
 * 
 * Usage: node src/seeders/superadmin.seeder.js
 */

const DEFAULT_SUPERADMIN = {
    email: 'superadmin@chemwaste.com',
    password: 'superadmin123', // Change this in production!
    fullName: 'Super Administrator',
    role: 'superadmin',
};

async function seedSuperAdmin() {
    try {
        logger.info('🌱 Seeding superadmin user...');

        // Check if superadmin already exists
        const existingSuperAdmin = await prisma.user.findUnique({
            where: { email: DEFAULT_SUPERADMIN.email },
        });

        if (existingSuperAdmin) {
            logger.warn('⚠️  Superadmin user already exists. Skipping seed.');
            return;
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(DEFAULT_SUPERADMIN.password, saltRounds);

        // Create superadmin user
        const superadmin = await prisma.user.create({
            data: {
                email: DEFAULT_SUPERADMIN.email,
                passwordHash,
                fullName: DEFAULT_SUPERADMIN.fullName,
                role: DEFAULT_SUPERADMIN.role,
                isActive: true,
            },
        });

        logger.info('✅ Superadmin user created successfully!');
        logger.info(`   Email: ${superadmin.email}`);
        logger.info(`   Password: ${DEFAULT_SUPERADMIN.password}`);
        logger.warn('⚠️  IMPORTANT: Change the default password after first login!');

        return superadmin;
    } catch (error) {
        logger.error('❌ Error seeding superadmin user:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('superadmin.seeder.js')) {
    seedSuperAdmin()
        .then(() => {
            logger.info('✅ Seeding completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('❌ Seeding failed:', error);
            process.exit(1);
        });
}

export default seedSuperAdmin;
