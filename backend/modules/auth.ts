import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, exec } from '../db.js';
import authMiddleware, { type AuthRequest } from '../middleware/auth.js';

type UserRecord = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: string;
  is_active?: number;
};

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '7d';

router.post('/login', async (req, res) => {
  const input = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!input || !password) {
    return res.status(400).json({ message: 'username/email and password are required' });
  }

  try {
    const users = (await query(
      'SELECT id, username, email, full_name, password_hash, role, is_active FROM users WHERE (username = ? OR email = ?) AND is_active = 1 LIMIT 1',
      [input, input]
    )) as UserRecord[];

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = users[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    if (user.is_active === 0) {
      return res.status(401).json({ message: 'Account is disabled' });
    }
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role || 'invigilator' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        username: user.username,
        role: user.role || 'invigilator',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return res.status(500).json({ message });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  return res.json({
    success: true,
    user: req.user,
  });
});

export default router;
