import express from 'express';
import { getAccounts } from './account.controller';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';

const router = express.Router();

router.get('/', verifyFirebaseToken, getAccounts);
// NOTE: Task 3 will handle full CRUD permissions

export const accountRoutes = router;
