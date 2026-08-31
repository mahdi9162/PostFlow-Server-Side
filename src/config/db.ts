import { MongoClient, ServerApiVersion, Db } from 'mongodb';
import { env } from './env';

const uri = env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db: Db;
let initDbPromise: Promise<Db> | null = null;

const initialAccounts = [
  {
    slug: 'snortpugs',
    displayName: 'Snortpugs',
    driveFolderName: 'Snortpugs',
    platform: 'instagram',
    isActive: true,
    order: 1,
  },
  {
    slug: 'pugsnortz',
    displayName: 'Pugsnortz',
    driveFolderName: 'Pugsnortz',
    platform: 'instagram',
    isActive: true,
    order: 2,
  },
  {
    slug: 'pugsnuff',
    displayName: 'Pugsnuff',
    driveFolderName: 'Pugsnuff',
    platform: 'instagram',
    isActive: true,
    order: 3,
  },
];

export const initializeDatabase = async (): Promise<Db> => {
  if (initDbPromise) {
    return initDbPromise;
  }

  initDbPromise = (async () => {
    try {
      db = client.db('postFlow-db');
      
      // Posts Indexes
      await db.collection('posts').createIndex(
        { account: 1, scheduledDate: 1, 'media.fingerprint': 1 },
        { 
          unique: true, 
          partialFilterExpression: { 
            account: { $type: 'string' },
            scheduledDate: { $type: 'string' },
            'media.fingerprint': { $type: 'string' }
          } 
        }
      );
      await db.collection('posts').createIndex({ account: 1, scheduledDate: 1, createdAt: -1 });

      // Users Indexes
      await db.collection('users').createIndex({ firebaseUid: 1 }, { unique: true });
      await db.collection('users').createIndex({ status: 1, createdAt: -1 });

      // Accounts Indexes
      await db.collection('accounts').createIndex({ slug: 1 }, { unique: true });
      await db.collection('accounts').createIndex({ order: 1 });

      // SyncRuns Indexes
      await db.collection('syncRuns').createIndex({ createdAt: 1 });
      await db.collection('syncRuns').createIndex({ status: 1 });
      await db.collection('syncRuns').createIndex({ targetDate: 1 });
      await db.collection('syncRuns').createIndex({ targetDate: 1, status: 1, triggeredBy: 1 });
      await db.collection('syncRuns').createIndex({ retryOf: 1, createdAt: -1 });

      // DriveAutomationRuns Indexes
      await db.collection('driveAutomationRuns').createIndex({ createdAt: -1 });
      await db.collection('driveAutomationRuns').createIndex({ n8nExecutionId: 1 });

      // Hashtag Collections Indexes
      await db.collection('hashtagGroups').createIndex({ account: 1, order: 1 });
      await db.collection('hashtagRotations').createIndex({ account: 1 }, { unique: true });

      // Idempotent Seed
      const accountsCollection = db.collection('accounts');
      for (const acc of initialAccounts) {
        await accountsCollection.updateOne(
          { slug: acc.slug },
          { $setOnInsert: { ...acc, createdAt: new Date(), updatedAt: new Date() } },
          { upsert: true }
        );
      }
      
      return db;
    } catch (error) {
      console.error('Error initializing MongoDB:', error);
      initDbPromise = null; // allow retry on next request if it failed
      throw error;
    }
  })();

  return initDbPromise;
};

export const getDB = () => {
  if (!db) {
    db = client.db('postFlow-db');
  }
  return db;
};
