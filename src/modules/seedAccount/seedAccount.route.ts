import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import {
  getSeedAccounts,
  getSeedAccountById,
  createSeedAccount,
  updateSeedAccount,
} from './seedAccount.controller';

const router = Router();

router.get('/', verifyFirebaseToken, getSeedAccounts);
router.get('/:id', verifyFirebaseToken, getSeedAccountById);
router.post('/', verifyFirebaseToken, createSeedAccount);
router.patch('/:id', verifyFirebaseToken, updateSeedAccount);

export default router;
