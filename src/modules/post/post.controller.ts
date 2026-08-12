import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as postService from './post.service';
import * as userService from '../user/user.service';
import { validateAndDeriveDay, parseDriveFileId } from './post.helper';
import { Post, PostMedia } from './post.types';

import { getNextHashtagGroup, advanceHashtagRotation } from '../hashtagGroup/hashtagGroup.helper';

export const createPost = async (req: Request, res: Response) => {
  try {
    const postData = req.body;

    if (!postData) {
      return res.status(400).json({ message: 'post required' });
    }

    const { account, scheduledDate, caption, cta, source, driveLink, hashtags, autoHashtags } = postData;

    if (!scheduledDate) {
      return res.status(400).json({ message: 'scheduledDate is required' });
    }

    const day = validateAndDeriveDay(scheduledDate);
    if (!day) {
      return res.status(400).json({ message: 'Invalid scheduledDate format or impossible date' });
    }

    let media: PostMedia | undefined;
    if (driveLink) {
      const fileId = parseDriveFileId(driveLink);
      if (!fileId) {
        return res.status(400).json({ message: 'Invalid Google Drive link provided' });
      }
      media = {
        provider: 'google-drive',
        driveFileId: fileId,
      };
    }

    let finalHashtags = hashtags;
    let consumedGroupOrder: number | null = null;
    let safeAccount = (account || '').trim().toLowerCase();

    if (autoHashtags) {
      const nextGroup = await getNextHashtagGroup(safeAccount);
      if (!nextGroup) {
        return res.status(400).json({ message: 'No enabled hashtag groups available for this account.' });
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
      createdBy: 'manual',
      createdAt: new Date(),
    };

    const result = await postService.createPost(post);

    if (consumedGroupOrder !== null) {
      await advanceHashtagRotation(safeAccount, consumedGroupOrder);
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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

    const { account, scheduledDate, caption, cta, source, hashtags, driveLink } = req.body;

    const updatedDoc: any = {
      $set: {
        updatedAt: new Date(),
        updatedBy: me.email,
      },
    };

    if (account !== undefined) updatedDoc.$set.account = account;
    if (caption !== undefined) updatedDoc.$set.caption = caption;
    if (cta !== undefined) updatedDoc.$set.cta = cta;
    if (source !== undefined) updatedDoc.$set.source = source || null;
    if (hashtags !== undefined) updatedDoc.$set.hashtags = hashtags;

    if (scheduledDate !== undefined) {
      const day = validateAndDeriveDay(scheduledDate);
      if (!day) {
        return res.status(400).json({ message: 'Invalid scheduledDate format or impossible date' });
      }
      updatedDoc.$set.scheduledDate = scheduledDate;
      updatedDoc.$set.day = day;
    }

    if (driveLink !== undefined) {
      if (driveLink === '') {
        updatedDoc.$set.driveLink = '';
        updatedDoc.$unset = updatedDoc.$unset || {};
        updatedDoc.$unset.media = '';
      } else {
        const fileId = parseDriveFileId(driveLink);
        if (!fileId) {
          return res.status(400).json({ message: 'Invalid Google Drive link provided' });
        }
        updatedDoc.$set.driveLink = driveLink;
        updatedDoc.$set.media = {
          provider: 'google-drive',
          driveFileId: fileId,
        };
      }
    }

    const result = await postService.updatePost(id, updatedDoc);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePostStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid post id' });
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

    if (!me || me.status !== 'approved' || (me.role !== 'admin' && me.role !== 'creator')) {
      return res.status(403).json({ message: 'Access: admin and creator only' });
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
