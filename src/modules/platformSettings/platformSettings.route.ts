import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { getSettings, updateSettings, previewCleanup, executeCleanup } from './platformSettings.controller';

const router = Router();

router.get('/', verifyFirebaseToken, getSettings);
router.patch('/', verifyFirebaseToken, updateSettings);

router.post('/cleanup/:target/preview', verifyFirebaseToken, previewCleanup);
router.post('/cleanup/:target/execute', verifyFirebaseToken, executeCleanup);

export default router;
