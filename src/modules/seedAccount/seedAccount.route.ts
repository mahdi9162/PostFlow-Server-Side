import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { verifyInternalApiKey } from '../../middleware/internalAuth.middleware';
import {
  getSeedAccounts,
  getSeedAccountById,
  createSeedAccount,
  updateSeedAccount,
  deleteSeedAccount,
  getActiveSeedsInternal,
  ingestDiscoveredCandidatesInternal,
} from './seedAccount.controller';

const router = Router();

// Public / Authenticated Team Endpoints
router.get('/', verifyFirebaseToken, getSeedAccounts);
router.get('/:id', verifyFirebaseToken, getSeedAccountById);
router.post('/', verifyFirebaseToken, createSeedAccount);
router.patch('/:id', verifyFirebaseToken, updateSeedAccount);
router.delete('/:id', verifyFirebaseToken, deleteSeedAccount);

// Internal Automation / n8n Endpoints
export const internalSeedAccountRouter = Router();
internalSeedAccountRouter.get('/active', verifyInternalApiKey, getActiveSeedsInternal);
internalSeedAccountRouter.post('/discovered', verifyInternalApiKey, ingestDiscoveredCandidatesInternal);

export default router;
