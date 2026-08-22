import { Router } from 'express';
import { prepareSync, getSyncStatus, internalFinalizeSync, internalFailSync, getSyncHistory, retryFailedSync } from './sync.controller';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { verifyInternalApiKey } from '../../middleware/internalAuth.middleware';

const router = Router();

router.post('/prepare', verifyFirebaseToken, prepareSync);
router.get('/history', verifyFirebaseToken, getSyncHistory);
router.get('/history/:syncId', verifyFirebaseToken, getSyncStatus);
router.get('/:syncId', verifyFirebaseToken, getSyncStatus);
router.post('/:syncId/retry-failed', verifyFirebaseToken, retryFailedSync);

export default router;

export const internalSyncRouter = Router();

internalSyncRouter.post('/:syncId/finalize', verifyInternalApiKey, internalFinalizeSync);
internalSyncRouter.post('/:syncId/fail', verifyInternalApiKey, internalFailSync);
