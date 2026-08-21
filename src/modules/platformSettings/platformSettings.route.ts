import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { getSettings, updateSettings, previewCleanup, executeCleanup, previewStaleSyncs, resolveStaleSyncs } from './platformSettings.controller';

const router = Router();

router.get('/', verifyFirebaseToken, getSettings);
router.patch('/', verifyFirebaseToken, updateSettings);

router.post('/cleanup/:target/preview', verifyFirebaseToken, previewCleanup);
router.post('/cleanup/:target/execute', verifyFirebaseToken, executeCleanup);

router.post('/stale-syncs/preview', verifyFirebaseToken, previewStaleSyncs);
router.post('/stale-syncs/resolve', verifyFirebaseToken, resolveStaleSyncs);

export default router;
