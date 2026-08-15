import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT || '3000',
  MONGODB_URI: process.env.MONGODB_URI || '',
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || '',
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || '',
  N8N_POSTFLOW_WEBHOOK_URL: process.env.N8N_POSTFLOW_WEBHOOK_URL || '',
  N8N_POSTFLOW_WEBHOOK_KEY: process.env.N8N_POSTFLOW_WEBHOOK_KEY || '',
};

if (!env.MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in environment variables.');
}

if (!env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT in environment variables.');
}
