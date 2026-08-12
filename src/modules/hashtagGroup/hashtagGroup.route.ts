import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import * as hashtagGroupController from './hashtagGroup.controller';
import catchAsync from '../../utils/catchAsync';

const router = Router();

router.post('/', verifyFirebaseToken, catchAsync(hashtagGroupController.createGroup));
router.get('/', verifyFirebaseToken, catchAsync(hashtagGroupController.getGroups));
router.patch('/reorder', verifyFirebaseToken, catchAsync(hashtagGroupController.reorderGroups));
router.patch('/:id', verifyFirebaseToken, catchAsync(hashtagGroupController.updateGroup));
router.delete('/:id', verifyFirebaseToken, catchAsync(hashtagGroupController.deleteGroup));

export const hashtagGroupRouter = router;
