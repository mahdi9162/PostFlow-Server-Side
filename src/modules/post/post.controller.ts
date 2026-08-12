import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as postService from './post.service';
import * as userService from '../user/user.service';
import { validateAndDeriveDay, parseDriveFileId } from './post.helper';
import { Post, PostMedia } from './post.types';

import { getNextHashtagGroup, advanceHashtagRotation } from '../hashtagGroup/hashtagGroup.helper';

const handleCreatePostLogic = async (postData: any, createdBy: 'manual' | 'automation') => {
  if (!postData) {
    throw new Error('post required');
  }

  const { account, scheduledDate, caption, cta, source, driveLink, media: inputMedia, hashtags, autoHashtags } = postData;

  if (!scheduledDate) {
    throw new Error('scheduledDate is required');
  }

  const day = validateAndDeriveDay(scheduledDate);
  if (!day) {
    throw new Error('Invalid scheduledDate format or impossible date');
  }

  let safeAccount = (account || '').trim().toLowerCase();
  if (!safeAccount) {
    const err: any = new Error('account is required and must be non-empty');
    err.statusCode = 400;
    throw err;
  }

  let media: PostMedia | undefined;
  if (driveLink) {
    const fileId = parseDriveFileId(driveLink);
    if (!fileId) {
      throw new Error('Invalid Google Drive link provided');
    }
    media = {
      provider: 'google-drive',
      driveFileId: fileId,
    };
  }

  // Handle explicit media object (from automation usually)
  if (inputMedia && typeof inputMedia === 'object') {
    if (!driveLink) {
      if (!inputMedia.provider || !inputMedia.driveFileId) {
        const err: any = new Error('provider and driveFileId are required when creating new media');
        err.statusCode = 400;
        throw err;
      }
      if (inputMedia.provider !== 'google-drive') {
        const err: any = new Error('Invalid media provider');
        err.statusCode = 400;
        throw err;
      }
      media = {
        provider: 'google-drive',
        driveFileId: inputMedia.driveFileId,
      };
    }

    // If it has fingerprint, use it
    if (inputMedia.fingerprint) {
      media = {
        ...(media || {}),
        fingerprint: inputMedia.fingerprint,
      } as PostMedia;
      
      const fingerprintRegex = /^[a-f0-9]{64}$/;
      if (!fingerprintRegex.test(media.fingerprint!)) {
        const err: any = new Error('Invalid fingerprint format');
        err.statusCode = 400;
        throw err;
      }
    }
  }

  if (media?.fingerprint) {
    if (!safeAccount) {
      const err: any = new Error('Account must be a non-empty string when using fingerprint');
      err.statusCode = 400;
      throw err;
    }

    const isDuplicate = await postService.checkDuplicatePost(safeAccount, scheduledDate, media.fingerprint);
    if (isDuplicate) {
      const err: any = new Error('Duplicate media already exists for this account and scheduled date.');
      err.statusCode = 409;
      throw err;
    }
  }

  let finalHashtags = hashtags;
  let consumedGroupOrder: number | null = null;

  if (autoHashtags) {
    const nextGroup = await getNextHashtagGroup(safeAccount);
    if (!nextGroup) {
      const err: any = new Error('No enabled hashtag groups available for this account.');
      err.statusCode = 400;
      throw err;
    }
    finalHashtags = nextGroup.hashtags.join(' ');
    consumedGroupOrder = nextGroup.order;
  }

  const post: Post = {
    account: safeAccount,
    scheduledDate,
    day,
    caption,
    cta,
    source: source || null,
    driveLink, // keeping legacy for compatibility
    media,
    hashtags: finalHashtags,
    status: 'pending',
    createdBy,
    createdAt: new Date(),
  };

  try {
    const result = await postService.createPost(post);
    if (consumedGroupOrder !== null) {
      await advanceHashtagRotation(safeAccount, consumedGroupOrder);
    }
    return result;
  } catch (error: any) {
    // Handle mongodb duplicate key error from unique index
    if (error.code === 11000) {
      const err: any = new Error('Duplicate media already exists for this account and scheduled date.');
      err.statusCode = 409;
      throw err;
    }
    throw error;
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const adminUser = await userService.findUserByFirebaseUid(uid);
    if (!adminUser || adminUser.status !== 'approved' || (adminUser.role !== 'admin' && adminUser.role !== 'creator')) {
      return res.status(403).json({ message: 'Forbidden: admin or creator only' });
    }

    const result = await handleCreatePostLogic(req.body, 'manual');
    res.status(200).json(result);
  } catch (error: any) {
    const status = error.statusCode || (error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500);
    res.status(status).json({ message: error.message });
  }
};

export const createInternalPost = async (req: Request, res: Response) => {
  try {
    const result = await handleCreatePostLogic(req.body, 'automation');
    res.status(200).json(result);
  } catch (error: any) {
    const status = error.statusCode || (error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500);
    res.status(status).json({ message: error.message });
  }
};

export const getPosts = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const { account, scheduledDate, status } = req.query;

    const me = await userService.findUserByFirebaseUid(uid);

    if (!me || me.status !== 'approved') {
      return res.status(403).json({ message: 'Access not approved' });
    }

    const query: any = {};

    if (account) {
      query.account = (account as string).trim().toLowerCase();
    }

    if (scheduledDate) {
      query.scheduledDate = (scheduledDate as string).trim();
    }

    if (status && status !== 'all') {
      query.status = (status as string).trim().toLowerCase();
    }

    const posts = await postService.findPosts(query);

    res.status(200).json(posts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePost = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const id = req.params.id as string;

    if (!uid) {
      return res.status(401).json({ message: 'Unauthorized: invalid token' });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid post id' });
    }

    const me = await userService.findUserByFirebaseUid(uid);

    if (!me || me.status !== 'approved' || (me.role !== 'admin' && me.role !== 'creator')) {
      return res.status(403).json({ message: 'Access: admin and creator only' });
    }

    const existingPosts = await postService.findPosts({ _id: new ObjectId(id) });
    if (!existingPosts || existingPosts.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const existingPost = existingPosts[0];

    const { account, scheduledDate, caption, cta, source, hashtags, driveLink, media: inputMedia } = req.body;

    const updatedDoc: any = {
      $set: {
        updatedAt: new Date(),
        updatedBy: me.email,
      },
      $unset: {}
    };

    let safeAccount: string | undefined = undefined;

    if (account !== undefined) {
      safeAccount = account.trim().toLowerCase();
      if (!safeAccount) {
        return res.status(400).json({ message: 'account must be a non-empty string' });
      }
      updatedDoc.$set.account = safeAccount;
    }
    
    if (caption !== undefined) updatedDoc.$set.caption = caption;
    if (cta !== undefined) updatedDoc.$set.cta = cta;
    if (source !== undefined) updatedDoc.$set.source = source || null;
    if (hashtags !== undefined) updatedDoc.$set.hashtags = hashtags;

    let safeScheduledDate = scheduledDate;

    if (scheduledDate !== undefined) {
      const day = validateAndDeriveDay(scheduledDate);
      if (!day) {
        return res.status(400).json({ message: 'Invalid scheduledDate format or impossible date' });
      }
      safeScheduledDate = scheduledDate;
      updatedDoc.$set.scheduledDate = scheduledDate;
      updatedDoc.$set.day = day;
    }

    let finalMedia: PostMedia | undefined = existingPost.media;
    let mediaChanged = false;

    if (driveLink !== undefined) {
      if (driveLink === '') {
        finalMedia = undefined;
        updatedDoc.$set.driveLink = '';
        updatedDoc.$unset.media = '';
        mediaChanged = true;
      } else if (driveLink !== existingPost.driveLink) {
        const fileId = parseDriveFileId(driveLink);
        if (!fileId) {
          return res.status(400).json({ message: 'Invalid Google Drive link provided' });
        }
        
        finalMedia = {
          provider: 'google-drive',
          driveFileId: fileId,
        };
        
        if (inputMedia?.fingerprint) {
          finalMedia.fingerprint = inputMedia.fingerprint;
        }

        updatedDoc.$set.driveLink = driveLink;
        mediaChanged = true;
      }
    }

    if (driveLink === undefined || driveLink === existingPost.driveLink) {
      if (inputMedia && typeof inputMedia === 'object' && inputMedia.fingerprint) {
        if (finalMedia) {
          finalMedia = {
            ...finalMedia,
            fingerprint: inputMedia.fingerprint
          };
        } else {
          if (!inputMedia.provider || !inputMedia.driveFileId) {
            return res.status(400).json({ message: 'provider and driveFileId are required when creating new media' });
          }
          if (inputMedia.provider !== 'google-drive') {
            return res.status(400).json({ message: 'Invalid media provider' });
          }
          finalMedia = {
            provider: 'google-drive',
            driveFileId: inputMedia.driveFileId,
            fingerprint: inputMedia.fingerprint
          };
        }
        mediaChanged = true;
      }
    }

    if (mediaChanged && finalMedia) {
      if (finalMedia.fingerprint) {
        const fingerprintRegex = /^[a-f0-9]{64}$/;
        if (!fingerprintRegex.test(finalMedia.fingerprint)) {
          return res.status(400).json({ message: 'Invalid fingerprint format' });
        }
      }
      updatedDoc.$set.media = finalMedia;
    }

    if (Object.keys(updatedDoc.$unset).length === 0) {
      delete updatedDoc.$unset;
    }

    const finalAccount = safeAccount !== undefined ? safeAccount : existingPost.account;
    const finalScheduledDate = safeScheduledDate !== undefined ? safeScheduledDate : existingPost.scheduledDate;

    if (finalMedia?.fingerprint) {
      if (!finalAccount || typeof finalAccount !== 'string' || !finalAccount.trim()) {
        return res.status(400).json({ message: 'Account must be a non-empty string when using fingerprint' });
      }
      if (!finalScheduledDate || typeof finalScheduledDate !== 'string') {
        return res.status(400).json({ message: 'scheduledDate must be a string when using fingerprint' });
      }
    }

    if (safeAccount || safeScheduledDate || mediaChanged) {
      if (finalMedia?.fingerprint) {
        const isDuplicate = await postService.checkDuplicatePost(finalAccount, finalScheduledDate, finalMedia.fingerprint, id);
        if (isDuplicate) {
          return res.status(409).json({ message: 'Duplicate media already exists for this account and scheduled date.' });
        }
      }
    }

    try {
      const result = await postService.updatePost(id, updatedDoc);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Duplicate media already exists for this account and scheduled date.' });
      }
      throw error;
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePostStatus = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const id = req.params.id as string;
    const { status } = req.body;

    if (!uid) {
      return res.status(401).json({ message: 'Unauthorized: invalid token' });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid post id' });
    }

    const me = await userService.findUserByFirebaseUid(uid);

    if (!me || me.status !== 'approved' || (me.role !== 'admin' && me.role !== 'creator' && me.role !== 'publisher')) {
      return res.status(403).json({ message: 'Access: admin, creator and publisher only' });
    }

    if (status !== 'posted' && status !== 'pending') {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updatedDoc: any = {
      $set: { status: status },
      $unset: {},
    };

    if (status === 'posted') {
      updatedDoc.$set.postedAt = new Date();
      delete updatedDoc.$unset;
    } else {
      updatedDoc.$unset = { postedAt: '' };
    }

    const result = await postService.updatePost(id, updatedDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    return res.json({ message: 'Marked as posted', modifiedCount: result.modifiedCount });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const id = req.params.id as string;

    if (!uid) {
      return res.status(401).json({ message: 'Unauthorized: invalid token' });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid post id' });
    }

    const me = await userService.findUserByFirebaseUid(uid);

    if (!me || me.status !== 'approved' || me.role !== 'admin') {
      return res.status(403).json({ message: 'Access: admin only' });
    }

    const result = await postService.deletePost(id);

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
