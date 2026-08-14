import { drive, drive_v3, auth as driveAuth } from '@googleapis/drive';
import { env } from './env';

let credentials: any;
if (env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) {
  try {
    credentials = JSON.parse(env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);
  } catch (error) {
    throw new Error('Failed to parse GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON in environment variables.');
  }
}

const auth = new driveAuth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

export const driveClient: drive_v3.Drive = drive({
  version: 'v3',
  auth,
});
