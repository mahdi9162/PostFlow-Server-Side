import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as accountService from './account.service';
import * as userService from '../user/user.service';

const slugRegex = /^[a-z0-9-]+$/;

// Admin-only validation helper
const checkAdminRole = async (uid: string) => {
  const user = await userService.findUserByFirebaseUid(uid);
  if (!user || user.status !== 'approved' || user.role !== 'admin') {
    return false;
  }
  return true;
};

// Valid roles for reading
const getReadRole = async (uid: string) => {
  const user = await userService.findUserByFirebaseUid(uid);
  if (!user || user.status !== 'approved' || !user.role || !['admin', 'creator', 'publisher'].includes(user.role)) {
    return null;
  }
  return user.role;
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const isAdmin = await checkAdminRole(uid);
    if (!isAdmin) return res.status(403).json({ message: 'Forbidden: admin only' });

    let { slug, displayName, driveFolderName, platform, isActive, order } = req.body;

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ message: 'slug is required and must be a string' });
    }
    slug = slug.trim().toLowerCase();
    
    if (!slugRegex.test(slug)) {
      return res.status(400).json({ message: 'Invalid slug format. Use only lowercase letters, numbers, and hyphens without spaces' });
    }

    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return res.status(400).json({ message: 'displayName is required and cannot be empty' });
    }
    
    if (!driveFolderName || typeof driveFolderName !== 'string' || !driveFolderName.trim()) {
      return res.status(400).json({ message: 'driveFolderName is required and cannot be empty' });
    }

    if (platform !== 'instagram') {
      return res.status(400).json({ message: 'Invalid platform. Only instagram is supported currently' });
    }

    let finalIsActive = true;
    if (isActive !== undefined) {
      if (isActive !== true && isActive !== false) {
        return res.status(400).json({ message: 'isActive must be a boolean' });
      }
      finalIsActive = isActive;
    }

    const orderNum = Number(order);
    if (!Number.isInteger(orderNum) || orderNum < 1) {
      return res.status(400).json({ message: 'order must be a positive integer' });
    }

    const existing = await accountService.getAccountBySlug(slug);
    if (existing) {
      return res.status(409).json({ message: 'An account with this slug already exists' });
    }

    const newAccount = {
      slug,
      displayName: displayName.trim(),
      driveFolderName: driveFolderName.trim(),
      platform,
      isActive: finalIsActive,
      order: orderNum,
    };

    const result = await accountService.createAccount(newAccount);
    const createdAccount = await accountService.getAccountById(result.insertedId.toString());
    res.status(201).json(createdAccount);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Duplicate slug' });
    }
    res.status(500).json({ message: 'Failed to create account.' });
  }
};

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const role = await getReadRole(uid);
    if (!role) return res.status(403).json({ message: 'Forbidden' });

    const query = role === 'admin' ? {} : { isActive: true };
    const accounts = await accountService.getAccounts(query);
    res.status(200).json({ accounts });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch accounts.' });
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const isAdmin = await checkAdminRole(uid);
    if (!isAdmin) return res.status(403).json({ message: 'Forbidden: admin only' });

    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid account id.' });
    }

    const existingAccount = await accountService.getAccountById(id);
    if (!existingAccount) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    let { slug, displayName, driveFolderName, platform, isActive, order } = req.body;
    const updates: any = {};

    if (slug !== undefined) {
      if (typeof slug !== 'string') {
        return res.status(400).json({ message: 'slug must be a string' });
      }
      slug = slug.trim().toLowerCase();
      if (!slugRegex.test(slug)) {
        return res.status(400).json({ message: 'Invalid slug format.' });
      }
      if (slug !== existingAccount.slug) {
        // Enforce uniqueness
        const duplicate = await accountService.getAccountBySlug(slug);
        if (duplicate) {
          return res.status(409).json({ message: 'Slug already exists.' });
        }
        // Slug change safety
        const inUse = await accountService.checkSlugInUse(existingAccount.slug);
        if (inUse) {
          return res.status(409).json({ message: 'Cannot change slug because the current slug is already in use by posts or hashtag groups.' });
        }
      }
      updates.slug = slug;
    }

    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || !displayName.trim()) {
        return res.status(400).json({ message: 'displayName cannot be empty' });
      }
      updates.displayName = displayName.trim();
    }

    if (driveFolderName !== undefined) {
      if (typeof driveFolderName !== 'string' || !driveFolderName.trim()) {
        return res.status(400).json({ message: 'driveFolderName cannot be empty' });
      }
      updates.driveFolderName = driveFolderName.trim();
    }

    if (platform !== undefined) {
      if (platform !== 'instagram') {
        return res.status(400).json({ message: 'Invalid platform.' });
      }
      updates.platform = platform;
    }

    if (isActive !== undefined) {
      if (isActive !== true && isActive !== false) {
        return res.status(400).json({ message: 'isActive must be a boolean' });
      }
      updates.isActive = isActive;
    }

    if (order !== undefined) {
      const orderNum = Number(order);
      if (!Number.isInteger(orderNum) || orderNum < 1) {
        return res.status(400).json({ message: 'order must be a positive integer' });
      }
      updates.order = orderNum;
    }

    await accountService.updateAccount(id, updates);
    const updatedAccount = await accountService.getAccountById(id);
    
    res.status(200).json(updatedAccount);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Slug already exists.' });
    }
    res.status(500).json({ message: 'Failed to update account.' });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const isAdmin = await checkAdminRole(uid);
    if (!isAdmin) return res.status(403).json({ message: 'Forbidden: admin only' });

    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid account id.' });
    }

    const existingAccount = await accountService.getAccountById(id);
    if (!existingAccount) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    // Delete reference protection
    const inUse = await accountService.checkSlugInUse(existingAccount.slug);
    if (inUse) {
      return res.status(409).json({ message: 'Account cannot be deleted because it is already in use. Deactivate it instead.' });
    }

    await accountService.deleteAccount(id);
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete account.' });
  }
};

export const getInternalAccounts = async (req: Request, res: Response) => {
  try {
    const activeAccounts = await accountService.findActiveInstagramAccounts();
    
    // Map to required n8n format
    const mappedAccounts = activeAccounts.map(acc => ({
      slug: acc.slug,
      displayName: acc.displayName,
      driveFolderName: acc.driveFolderName
    }));

    res.status(200).json({ accounts: mappedAccounts });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch internal accounts.' });
  }
};
