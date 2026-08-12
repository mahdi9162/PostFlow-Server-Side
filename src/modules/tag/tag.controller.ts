import { Request, Response } from 'express';
import * as tagService from './tag.service';
import * as userService from '../user/user.service';

export const createTag = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const tags = req.body;

    if (!uid) return res.status(401).json({ message: 'Unauthorized' });
    if (!tags) return res.status(400).json({ message: 'tags required' });

    const adminUser = await userService.findUserByFirebaseUid(uid);

    if (!adminUser || adminUser.status !== 'approved' || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    tags.account = tags.account.trim().toLowerCase();
    tags.createdAt = new Date();
    const result = await tagService.createTag(tags);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getTags = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const { accountId } = req.query;
    if (!accountId) {
      return res.status(400).json({ message: 'accountId query param is required' });
    }

    // 1) verify admin user
    const adminUser = await userService.findUserByFirebaseUid(uid);
    if (!adminUser || adminUser.status !== 'approved' || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    const result = await tagService.findTagsByAccount(accountId as string);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
