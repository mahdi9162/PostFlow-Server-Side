import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as hashtagGroupService from './hashtagGroup.service';
import * as userService from '../user/user.service';
import { validateAndNormalizeHashtags } from './hashtagGroup.helper';

export const createGroup = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const { account, name, hashtags, enabled } = req.body;

    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const adminUser = await userService.findUserByFirebaseUid(uid);
    if (!adminUser || adminUser.status !== 'approved' || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    if (!account || !name || !Array.isArray(hashtags)) {
      return res.status(400).json({ message: 'account, name, and hashtags array are required' });
    }

    const { valid, normalized, error } = validateAndNormalizeHashtags(hashtags);
    if (!valid) {
      return res.status(400).json({ message: error });
    }

    // Determine order: find max order for account
    const existingGroups = await hashtagGroupService.findGroupsByAccount(account.trim().toLowerCase());
    const maxOrder = existingGroups.length > 0 ? Math.max(...existingGroups.map((g) => g.order)) : 0;

    const group = {
      account: account.trim().toLowerCase(),
      name: name.trim(),
      hashtags: normalized,
      order: maxOrder + 1,
      enabled: typeof enabled === 'boolean' ? enabled : true,
      createdAt: new Date(),
    };

    const result = await hashtagGroupService.createGroup(group);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getGroups = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const { accountId } = req.query;
    if (!accountId) {
      return res.status(400).json({ message: 'accountId query param is required' });
    }

    const adminUser = await userService.findUserByFirebaseUid(uid);
    if (!adminUser || adminUser.status !== 'approved' || (adminUser.role !== 'admin' && adminUser.role !== 'creator')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const result = await hashtagGroupService.findGroupsByAccount((accountId as string).trim().toLowerCase());
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateGroup = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const id = req.params.id as string;
    const { name, hashtags, enabled } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group id' });
    }

    const adminUser = await userService.findUserByFirebaseUid(uid);
    if (!adminUser || adminUser.status !== 'approved' || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    const updatedData: Partial<import('./hashtagGroup.types').HashtagGroup> = { updatedAt: new Date() };

    if (name !== undefined) updatedData.name = name.trim();
    if (enabled !== undefined) updatedData.enabled = enabled;
    
    if (hashtags !== undefined) {
      const { valid, normalized, error } = validateAndNormalizeHashtags(hashtags);
      if (!valid) {
        return res.status(400).json({ message: error });
      }
      updatedData.hashtags = normalized;
    }

    const result = await hashtagGroupService.updateGroup(id, updatedData);
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.status(200).json({ message: 'Group updated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const id = req.params.id as string;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group id' });
    }

    const adminUser = await userService.findUserByFirebaseUid(uid);
    if (!adminUser || adminUser.status !== 'approved' || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }
    
    // Fetch the group first so its account can be used to normalize ordering after deletion.
    const groupToDelete = await hashtagGroupService.findGroupById(id);

    if (!groupToDelete) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const result = await hashtagGroupService.deleteGroup(id);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Normalize order after deletion
    await hashtagGroupService.normalizeAccountOrder(groupToDelete.account);

    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const reorderGroups = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const { account, orderedGroupIds } = req.body;

    const adminUser = await userService.findUserByFirebaseUid(uid);
    if (!adminUser || adminUser.status !== 'approved' || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    if (!account || !Array.isArray(orderedGroupIds)) {
      return res.status(400).json({ message: 'account and orderedGroupIds array are required' });
    }
    
    const safeAccount = account.trim().toLowerCase();

    // 2. Validate every supplied ID
    for (const id of orderedGroupIds) {
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid group id: ${id}` });
      }
    }

    // 5. Ensure there are no duplicate IDs
    const uniqueIds = new Set(orderedGroupIds);
    if (uniqueIds.size !== orderedGroupIds.length) {
      return res.status(400).json({ message: 'Duplicate group IDs are not allowed' });
    }

    // 3. Load the hashtag groups belonging to that account
    const existingGroups = await hashtagGroupService.findGroupsByAccount(safeAccount);
    
    // 6. Ensure the reorder payload represents the expected set of groups being reordered
    if (existingGroups.length !== orderedGroupIds.length) {
      return res.status(400).json({ message: 'The number of provided IDs does not match the total groups for this account' });
    }

    // 4. Ensure the supplied IDs belong only to that account
    const existingIds = new Set(existingGroups.map((g) => g._id!.toString()));
    for (const id of orderedGroupIds) {
      if (!existingIds.has(id)) {
        return res.status(400).json({ message: `ID ${id} does not belong to account ${safeAccount} or does not exist` });
      }
    }

    // 7. Assign orders deterministically
    const updates = orderedGroupIds.map((id, index) => ({
      id,
      order: index + 1,
    }));

    await hashtagGroupService.bulkUpdateOrder(updates);
    res.status(200).json({ message: 'Reordered successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
