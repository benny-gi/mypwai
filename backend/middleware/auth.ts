import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    role?: string;
    fullName?: string;
  };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      email: string;
    };

    const users = (await query(
      'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = ? AND username = ? AND email = ? AND is_active = 1 LIMIT 1',
      [decoded.id, decoded.username, decoded.email]
    )) as Array<{ id: number; username: string; email: string; full_name: string; role: string; is_active?: number }>;

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const user = users[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
    next();
  } catch (error) {
    const message =
      error instanceof jwt.TokenExpiredError
        ? 'Token expired'
        : error instanceof jwt.JsonWebTokenError
          ? 'Invalid token'
          : 'Authentication failed';
    return res.status(401).json({ message });
  }
};

export default authMiddleware;
