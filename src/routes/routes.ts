import { Router } from 'express';
import { userRouter, accessRequestRouter } from '../modules/user/user.route';
import { postRouter, internalPostRouter } from '../modules/post/post.route';
import { tagRouter } from '../modules/tag/tag.route';
import { hashtagGroupRouter } from '../modules/hashtagGroup/hashtagGroup.route';
import syncRouter, { internalSyncRouter } from '../modules/sync/sync.route';
import { accountRoutes, internalAccountRoutes } from '../modules/account/account.route';
import platformSettingsRouter from '../modules/platformSettings/platformSettings.route';
import dataCleanupRouter from '../modules/dataCleanup/dataCleanup.route';

const router = Router();

router.use('/users', userRouter);
router.use('/access-requests', accessRequestRouter);
router.use('/posts', postRouter);
router.use('/internal/posts', internalPostRouter);
router.use('/tags', tagRouter);
router.use('/hashtagGroups', hashtagGroupRouter);
router.use('/sync', syncRouter);
router.use('/accounts', accountRoutes);
router.use('/internal/accounts', internalAccountRoutes);
router.use('/internal/sync', internalSyncRouter);
router.use('/settings/platform', platformSettingsRouter);
router.use('/internal/cron/data-cleanup', dataCleanupRouter);

export default router;
