import { Router } from 'express';
import { userRouter, accessRequestRouter } from '../modules/user/user.route';
import { postRouter } from '../modules/post/post.route';
import { tagRouter } from '../modules/tag/tag.route';

const router = Router();

router.use('/users', userRouter);
router.use('/access-requests', accessRequestRouter);
router.use('/posts', postRouter);
router.use('/tags', tagRouter);

export default router;
