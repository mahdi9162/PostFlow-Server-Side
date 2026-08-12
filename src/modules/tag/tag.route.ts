import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import * as tagController from './tag.controller';
import catchAsync from '../../utils/catchAsync';

const router = Router();

router.post('/', verifyFirebaseToken, catchAsync(tagController.createTag));

router.get('/', verifyFirebaseToken, catchAsync(tagController.getTags));

export const tagRouter = router;
