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

export const updatePost = async (id: string, updateData: any) => {
  return await getCollection().updateOne(
    { _id: new ObjectId(id) },
    updateData
  );
};

export const deletePost = async (id: string) => {
  return await getCollection().deleteOne({ _id: new ObjectId(id) });
};
