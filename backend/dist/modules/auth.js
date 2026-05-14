import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, exec } from '../db.js';
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '7d';
router.post('/signup', async (req, res) => {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const usernameInput = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const username = usernameInput || email;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!fullName || !email || !username || !password) {
        return res.status(400).json({ message: 'fullName, email, username, and password are required' });
    }
    try {
        // Check if user exists
        const existingUsers = (await query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]));
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'An account with this email or username already exists' });
        }
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        // Insert user
        await exec('INSERT INTO users (username, email, full_name, password_hash) VALUES (?, ?, ?, ?)', [username, email, fullName, passwordHash]);
        return res.status(201).json({
            success: true,
            user: { fullName, email, username },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create account';
        return res.status(500).json({ message });
    }
});
router.post('/login', async (req, res) => {
    const input = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!input || !password) {
        return res.status(400).json({ message: 'username/email and password are required' });
    }
    try {
        const users = (await query('SELECT id, username, email, full_name, password_hash FROM users WHERE username = ? OR email = ?', [input, input]));
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const user = users[0];
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        // Generate JWT token
        const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                username: user.username,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        return res.status(500).json({ message });
    }
});
export default router;
//# sourceMappingURL=auth.js.map