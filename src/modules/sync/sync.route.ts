import { Router } from 'express';
import { prepareSync, getSyncStatus, internalCompleteSync, internalFailSync } from './sync.controller';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { verifyInternalApiKey } from '../../middleware/internalAuth.middleware';

const router = Router();

router.post('/prepare', verifyFirebaseToken, prepareSync);
router.get('/:syncId', verifyFirebaseToken, getSyncStatus);

export default router;

export const internalSyncRouter = Router();

internalSyncRouter.post('/:syncId/complete', verifyInternalApiKey, internalCompleteSync);
internalSyncRouter.post('/:syncId/fail', verifyInternalApiKey, internalFailSync);
