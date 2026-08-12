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

export const initializeDatabase = async (): Promise<Db> => {
  if (initDbPromise) {
    return initDbPromise;
  }

  initDbPromise = (async () => {
    try {
      db = client.db('postFlow-db');
      
      // Initialize collections and indexes safely
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
