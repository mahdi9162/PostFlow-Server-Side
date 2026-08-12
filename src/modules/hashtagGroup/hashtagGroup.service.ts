import { ObjectId } from 'mongodb';
import { getDB } from '../../config/db';
import { HashtagGroup } from './hashtagGroup.types';

const getCollection = () => getDB().collection<HashtagGroup>('hashtagGroups');
const getRotationCollection = () => getDB().collection('hashtagRotations');

export const createGroup = async (group: HashtagGroup) => {
  return await getCollection().insertOne(group);
};

export const findGroupsByAccount = async (account: string) => {
  return await getCollection().find({ account }).sort({ order: 1 }).toArray();
};

export const findGroupById = async (id: string) => {
  return await getCollection().findOne({ _id: new ObjectId(id) });
};

export const updateGroup = async (id: string, updatedData: Partial<HashtagGroup>) => {
  return await getCollection().updateOne({ _id: new ObjectId(id) }, { $set: updatedData });
};

export const deleteGroup = async (id: string) => {
  return await getCollection().deleteOne({ _id: new ObjectId(id) });
};

export const bulkUpdateOrder = async (updates: { id: string; order: number }[]) => {
  if (updates.length === 0) return;
  const operations = updates.map((update) => ({
    updateOne: {
      filter: { _id: new ObjectId(update.id) },
      update: { $set: { order: update.order, updatedAt: new Date() } },
    },
  }));
  return await getCollection().bulkWrite(operations);
};

export const normalizeAccountOrder = async (account: string) => {
  const groups = await findGroupsByAccount(account);
  const updates = groups.map((g, index) => ({
    id: g._id!.toString(),
    order: index + 1,
  }));
  await bulkUpdateOrder(updates);
};

// --- Rotation Service Logic ---

export const getRotationCursor = async (account: string) => {
  const rotation = await getRotationCollection().findOne({ account });
  if (!rotation) {
    return { account, nextOrder: 1, updatedAt: new Date() };
  }
  return rotation;
};

export const saveRotationCursor = async (account: string, nextOrder: number) => {
  return await getRotationCollection().updateOne(
    { account },
    { $set: { nextOrder, updatedAt: new Date() } },
    { upsert: true }
  );
};
