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

export const connectDB = async () => {
  try {
    // await client.connect(); // Wait, in the original code, client.connect() was commented out, native driver handles it internally if we just call db operations, but it's good practice. I'll stick to original behavior (commented out or just use it). Actually, original code has it commented out but it still works because MongoClient connects automatically on the first operation in v4+.
    db = client.db('postFlow-db');
    console.log('Successfully connected to MongoDB!');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    db = client.db('postFlow-db');
  }
  return db;
};
