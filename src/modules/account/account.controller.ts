import { Request, Response } from 'express';
import * as accountService from './account.service';

const slugRegex = /^[a-z0-9-]+$/;

export const createAccount = async (req: Request, res: Response) => {
  try {
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
    res.status(201).json(result);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Duplicate slug' });
    }
    res.status(500).json({ message: 'Failed to create account.' });
  }
};

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await accountService.getAccounts();
    res.status(200).json({ accounts });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch accounts.' });
  }
};
