import { Router } from 'express';
import { userRouter, accessRequestRouter } from '../modules/user/user.route';
import { postRouter, internalPostRouter } from '../modules/post/post.route';
import { tagRouter } from '../modules/tag/tag.route';
import { hashtagGroupRouter } from '../modules/hashtagGroup/hashtagGroup.route';
import syncRouter from '../modules/sync/sync.route';

const router = Router();

router.use('/users', userRouter);
router.use('/access-requests', accessRequestRouter);
router.use('/posts', postRouter);
router.use('/internal/posts', internalPostRouter);
router.use('/tags', tagRouter);
router.use('/hashtagGroups', hashtagGroupRouter);
router.use('/sync', syncRouter);

export default router;
