import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as postService from './post.service';
import * as userService from '../user/user.service';

export const createPost = async (req: Request, res: Response) => {
  try {
    const post = req.body;

    if (!post) {
      return res.status(400).json({ message: 'post required' });
    }

    post.account = post.account.trim().toLowerCase();
    post.day = post.day.trim().toLowerCase();
    post.createdAt = new Date();
    post.status = 'pending';
    const result = await postService.createPost(post);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPosts = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const { account, day, status } = req.query;

    const me = await userService.findUserByFirebaseUid(uid);

    if (!me || me.status !== 'approved') {
      return res.status(403).json({ message: 'Access not approved' });
    }

    const query: any = {};

    if (account) {
      query.account = (account as string).trim().toLowerCase();
    }

    if (day) {
      query.day = (day as string).trim().toLowerCase();
    }

    if (status && status !== 'all') {
      query.status = (status as string).trim().toLowerCase();
    }

    // show only current batch: today + previous 6 days
    const batchStartDate = new Date();
    batchStartDate.setDate(batchStartDate.getDate() - 6);
    batchStartDate.setHours(0, 0, 0, 0);

    query.createdAt = {
      $gte: batchStartDate,
    };

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

    // only allow these fields to update
    const { account, day, caption, cta, source, hashtags, driveLink } = req.body;

    const updatedDoc = {
      $set: {
        account,
        day,
        caption,
        cta,
        source,
        driveLink,
        hashtags,
        updatedAt: new Date(),
        updatedBy: me.email,
      },
    };

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
