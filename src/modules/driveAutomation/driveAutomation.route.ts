import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import { verifyInternalApiKey } from '../../middleware/internalAuth.middleware';
import { fetchLatestRun, recordRun } from './driveAutomation.controller';

const publicRouter = Router();
publicRouter.get('/runs/latest', verifyFirebaseToken, fetchLatestRun);

export const driveAutomationRouter = publicRouter;

const internalRouter = Router();
internalRouter.post('/runs', verifyInternalApiKey, recordRun);

export const internalDriveAutomationRouter = internalRouter;
