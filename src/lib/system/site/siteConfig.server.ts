import { env } from '$env/dynamic/private';

export const siteUploadPath = env.SITE_UPLOAD_PATH || '/var/www/html';
