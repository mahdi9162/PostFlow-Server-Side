import { Router } from 'express';
import { prepareSync } from './sync.controller';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';

const router = Router();

router.post('/prepare', verifyFirebaseToken, prepareSync);

export default router;
