import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import * as postController from './post.controller';
import catchAsync from '../../utils/catchAsync';

const router = Router();

// FOR POSTS - get api
router.get('/', verifyFirebaseToken, catchAsync(postController.getPosts));

// FOR POSTS - post api
router.post('/', catchAsync(postController.createPost));

// post update api
router.patch('/:id', verifyFirebaseToken, catchAsync(postController.updatePost));

// update api : mark as posted/pending
router.patch('/:id/status', catchAsync(postController.updatePostStatus));

export const postRouter = router;
