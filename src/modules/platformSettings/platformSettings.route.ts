import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { getSettings, updateSettings } from './platformSettings.controller';

const router = Router();

router.get('/', verifyFirebaseToken, getSettings);
router.patch('/', verifyFirebaseToken, updateSettings);

export default router;
