import express from 'express';
import { getAccounts, createAccount, updateAccount, deleteAccount, getInternalAccounts } from './account.controller';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { verifyInternalApiKey } from '../../middleware/internalAuth.middleware';

const router = express.Router();

router.get('/', verifyFirebaseToken, getAccounts);
router.post('/', verifyFirebaseToken, createAccount);
router.patch('/:id', verifyFirebaseToken, updateAccount);
router.delete('/:id', verifyFirebaseToken, deleteAccount);

export const accountRoutes = router;

const internalRouter = express.Router();
internalRouter.get('/', verifyInternalApiKey, getInternalAccounts);

export const internalAccountRoutes = internalRouter;
