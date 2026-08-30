import { getDB } from '../../config/db';
import { ObjectId } from 'mongodb';
import { Post } from './post.types';

const getCollection = () => getDB().collection<Post>('posts');

export const createPost = async (post: Post) => {
  return await getCollection().insertOne(post);
};

export const findPosts = async (query: any) => {
  return await getCollection().find(query).sort({ createdAt: -1 }).limit(10).toArray();
};

export const checkDuplicatePost = async (account: string, scheduledDate: string, fingerprint: string, excludeId?: string) => {
  const query: any = { account, scheduledDate, 'media.fingerprint': fingerprint };
  if (excludeId) {
    query._id = { $ne: new ObjectId(excludeId) };
  }
  return await getCollection().findOne(query);
};

export const updatePost = async (id: string, updateData: any) => {
  return await getCollection().updateOne(
    { _id: new ObjectId(id) },
    updateData
  );
};

export const countPreparedPosts = async (account: string, scheduledDate: string): Promise<number> => {
  return await getCollection().countDocuments({ account, scheduledDate });
};

export const getPreparedDriveFileIds = async (account: string, scheduledDate: string): Promise<string[]> => {
  const posts = await getCollection()
    .find({ account, scheduledDate }, { projection: { 'media.driveFileId': 1 } })
    .toArray();
  
  return posts
    .map(p => p.media?.driveFileId)
    .filter((id): id is string => !!id);
};

export const deletePost = async (id: string) => {
  return await getCollection().deleteOne({ _id: new ObjectId(id) });
};
