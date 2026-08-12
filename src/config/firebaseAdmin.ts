import admin from 'firebase-admin';
import { env } from './env';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON or initialize Firebase admin');
    throw new Error('Firebase Admin initialization failed.');
  }
}

export default admin;
