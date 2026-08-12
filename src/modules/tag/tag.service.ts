import { getDB } from '../../config/db';
import { Tag } from './tag.types';

const getCollection = () => getDB().collection<Tag>('tags');

export const createTag = async (tag: Tag) => {
  return await getCollection().insertOne(tag);
};

export const findTagsByAccount = async (accountId: string) => {
  return await getCollection().find({ account: accountId }).sort({ createdAt: -1 }).toArray();
};
