import crypto from 'crypto';
import { driveClient } from '../../config/drive.config';

export const validateAndDeriveDay = (dateString: string): string | null => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split('-').map(Number);

  const d = new Date(Date.UTC(year, month - 1, day));

  // Check if date rolled over (e.g., Feb 29 on non-leap year becomes Mar 1)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[d.getUTCDay()];
};

export const parseDriveFileId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

export const generateDriveFileFingerprint = async (fileId: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    let streamRes;
    try {
      streamRes = await driveClient.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
    } catch (error: any) {
      const status = error.code || error.status || 500;
      if (status === 404) {
        return reject(new Error('Media file is not found in Google Drive.'));
      }
      if (status === 403) {
        return reject(new Error('You do not have access to this Google Drive media.'));
      }
      return reject(new Error('Failed to access Google Drive media.'));
    }

    const hash = crypto.createHash('sha256');
    const driveStream: any = streamRes.data;

    driveStream.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });

    driveStream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    driveStream.on('error', (err: any) => {
      reject(new Error('Failed to process Google Drive media stream.'));
    });
  });
};
