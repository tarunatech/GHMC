import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { logger } from './logger.js';

const s3Client = new S3Client({
    region: 'auto',
    endpoint: config.storage.endpoint,
    credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
    },
});

export const uploadFile = async (fileBuffer, fileName, contentType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: config.storage.bucketName,
            Key: fileName,
            Body: fileBuffer,
            ContentType: contentType,
        });

        await s3Client.send(command);

        // Return the public URL if any, or a way to get it
        return `${config.storage.publicUrl}/${fileName}`;
    } catch (error) {
        logger.error('Error uploading file to R2:', error);
        throw error;
    }
};

export const getDownloadUrl = async (fileName) => {
    try {
        const command = new GetObjectCommand({
            Bucket: config.storage.bucketName,
            Key: fileName,
        });

        // Generate a signed URL that expires in 1 hour
        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (error) {
        logger.error('Error getting signed URL from R2:', error);
        throw error;
    }
};
