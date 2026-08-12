import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/auth.middleware';
import * as userController from './user.controller';
import catchAsync from '../../utils/catchAsync';

const router = Router();

// FOR USERS - get my status api for first time signIn user
router.get('/me', verifyFirebaseToken, catchAsync(userController.getMyStatus));

// FOR USERS - post api
router.post('/', verifyFirebaseToken, catchAsync(userController.createUserRequest));

// Access Requests (can be part of user module as it interacts with users)
// Note: In index.js, these are /api/access-requests, we can mount them there in routes.ts
export const accessRequestRouter = Router();

// FOR USERS - get api only admin
accessRequestRouter.get('/', verifyFirebaseToken, catchAsync(userController.getAccessRequests));

// FOR USERS - update api only admin
accessRequestRouter.patch('/:id/approve', verifyFirebaseToken, catchAsync(userController.approveAccessRequest));

export const userRouter = router;
