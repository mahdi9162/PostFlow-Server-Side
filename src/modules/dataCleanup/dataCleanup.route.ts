import { Router } from 'express';
import { runScheduledCleanup } from './dataCleanup.controller';
import { verifyCronSecret } from '../../middleware/cron.middleware';

const router = Router();

router.get('/', verifyCronSecret, runScheduledCleanup);

export default router;
