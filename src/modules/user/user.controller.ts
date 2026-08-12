import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as userService from './user.service';

export const createUserRequest = async (req: Request, res: Response) => {
  try {
    const { uid, email } = req.user!;

    // role validation
    const requestedRole = (req.body?.role || '').toLowerCase();
    const allowedRoles = ['creator', 'publisher', 'admin'];

    if (!allowedRoles.includes(requestedRole)) {
      return res.status(400).json({ message: 'Invalid role. Role is required.' });
    }

    const existing = await userService.findUserByFirebaseUid(uid);

    if (existing) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const body = {
      firebaseUid: uid,
      email: email || '',
      requestedRole,
      status: 'pending',
      role: null,
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
    };

    const result = await userService.createUser(body);
    return res.status(201).json({
      message: 'User request saved (pending approval)',
      insertedId: result.insertedId,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAccessRequests = async (req: Request, res: Response) => {
  const { uid } = req.user!;

  try {
    const me = await userService.findUserByFirebaseUid(uid);

    if (!me || me.status !== 'approved' || me.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    const result = await userService.findPendingRequests();

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveAccessRequest = async (req: Request, res: Response) => {
  try {
    const { uid } = req.user!;
    const id = req.params.id as string;

    if (!uid) return res.status(401).json({ message: 'Unauthorized' });
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid request id' });

    // admin check
    const me = await userService.findUserByFirebaseUid(uid);

    if (!me || me.status !== 'approved' || me.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    // target user
    const user = await userService.findUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedDoc = {
      status: 'approved',
      role: user.requestedRole,
      approvedAt: new Date(),
      approvedBy: me.email,
    };

    const result = await userService.updateUserStatus(id, updatedDoc);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyStatus = async (req: Request, res: Response) => {
  try {
    const { uid, email } = req.user || {};

    if (!uid) {
      return res.status(401).json({ message: 'Unauthorized: invalid token' });
    }

    const me = await userService.findUserByFirebaseUid(uid);

    if (!me) {
      return res.status(404).json({
        message: 'User record not found. Submit access request first.',
        status: 'not_found',
        role: null,
        requestedRole: null,
      });
    }

    return res.status(200).json({
      email: me.email || email || null,
      status: me.status ?? 'pending',
      role: me.role ?? null,
      requestedRole: me.requestedRole ?? null,
      approvedAt: me.approvedAt ?? null,
      approvedBy: me.approvedBy ?? null,
      createdAt: me.createdAt ?? null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Server error' });
  }
};
