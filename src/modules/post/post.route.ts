import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { verifyInternalApiKey } from '../../middleware/internalAuth.middleware';
import * as postController from './post.controller';
import catchAsync from '../../utils/catchAsync';

const router = Router();

// FOR POSTS - get api
router.get('/', verifyFirebaseToken, catchAsync(postController.getPosts));

// FOR POSTS - post api (website)
router.post('/', verifyFirebaseToken, catchAsync(postController.createPost));

// update api
router.patch('/:id', verifyFirebaseToken, catchAsync(postController.updatePost));

// update api : mark as posted/pending
router.patch('/:id/status', verifyFirebaseToken, catchAsync(postController.updatePostStatus));

// download media api
router.get('/:id/media/download', verifyFirebaseToken, catchAsync(postController.downloadPostMedia));

// preview media api
router.get('/:id/media/preview', verifyFirebaseToken, catchAsync(postController.previewPostMedia));

// post delete api
router.delete('/:id', verifyFirebaseToken, catchAsync(postController.deletePost));


export const postRouter = router;

export const internalPostRouter = Router();

// FOR POSTS - internal automation api
internalPostRouter.post('/', verifyInternalApiKey, catchAsync(postController.createInternalPost));

// Internal pre-check duplicate api
internalPostRouter.post('/check-duplicate', verifyInternalApiKey, catchAsync(postController.checkDuplicate));
