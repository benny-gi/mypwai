import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { query, exec } from '../db.js';

const router = express.Router();

/**
 * Generate a random 8-character alphanumeric password.
 */
function generatePassword(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8);
}

// ---------- LIST invigilators ----------
router.get('/invigilators', async (_req, res) => {
  try {
    const rows = (await query(
      `SELECT id, username, email, full_name, created_at, is_active, deleted_at
       FROM users
       WHERE role = 'invigilator'
       ORDER BY created_at DESC`
    )) as any[];
    return res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list invigilators';
    return res.status(500).json({ message });
  }
});

// ---------- CREATE single invigilator ----------
router.post('/invigilators', async (req, res) => {
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!fullName) {
    return res.status(400).json({ message: 'fullName is required' });
  }
  if (!email) {
    return res.status(400).json({ message: 'email is required' });
  }

  // Generate username from email (use email prefix as username)
  const username = email;
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const existing = (await query(
      `SELECT id, is_active FROM users WHERE email = ? AND role = 'invigilator' LIMIT 1`,
      [email]
    )) as Array<{ id: number; is_active?: number }>;

    if (existing.length > 0) {
      const user = existing[0];
      if (!user) {
        throw new Error('Unable to resolve existing invigilator');
      }

      if (user.is_active) {
        return res.status(409).json({ message: 'An invigilator with this email already exists' });
      }

      await exec(
        `UPDATE users
         SET username = ?, full_name = ?, password_hash = ?, is_active = 1, deleted_at = NULL
         WHERE id = ? AND role = 'invigilator'`,
        [username, fullName, passwordHash, user.id]
      );

      return res.status(201).json({
        success: true,
        invigilator: { username, fullName, email },
        generatedPassword: password,
      });
    }

    await exec(
      `INSERT INTO users (username, email, full_name, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'invigilator', 1)`,
      [username, email, fullName, passwordHash]
    );
    return res.status(201).json({
      success: true,
      invigilator: { username, fullName, email },
      generatedPassword: password, // Only returned once!
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An invigilator with this email already exists' });
    }
    const message = error instanceof Error ? error.message : 'Failed to create invigilator';
    return res.status(500).json({ message });
  }
});

// ---------- BULK CREATE invigilators ----------
router.post('/invigilators/bulk', async (req, res) => {
  const entries = req.body?.entries;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ message: 'entries array is required and must not be empty' });
  }

  const results: { email: string; fullName: string; username: string; generatedPassword: string; status: 'created' | 'skipped'; reason?: string }[] = [];
  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const email = typeof entry?.email === 'string' ? entry.email.trim().toLowerCase() : '';
    const fullName = typeof entry?.fullName === 'string' ? entry.fullName.trim() : '';

    if (!email || !fullName) {
      results.push({
        email: email || '(empty)',
        fullName: fullName || '(empty)',
        username: '',
        generatedPassword: '',
        status: 'skipped',
        reason: 'Missing email or fullName',
      });
      skipped++;
      continue;
    }

    const username = email;
    const password = generatePassword();

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const existing = (await query(
        `SELECT id, is_active FROM users WHERE email = ? AND role = 'invigilator' LIMIT 1`,
        [email]
      )) as Array<{ id: number; is_active?: number }>;

      if (existing.length > 0) {
        const user = existing[0];
        if (!user) {
          throw new Error('Unable to resolve existing invigilator');
        }

        if (user.is_active) {
          results.push({ email, fullName, username, generatedPassword: '', status: 'skipped', reason: 'Email already exists' });
          skipped++;
          continue;
        }

        await exec(
          `UPDATE users
           SET username = ?, full_name = ?, password_hash = ?, is_active = 1, deleted_at = NULL
           WHERE id = ? AND role = 'invigilator'`,
          [username, fullName, passwordHash, user.id]
        );
        results.push({ email, fullName, username, generatedPassword: password, status: 'created' });
        created++;
        continue;
      }

      await exec(
        `INSERT INTO users (username, email, full_name, password_hash, role, is_active)
         VALUES (?, ?, ?, ?, 'invigilator', 1)`,
        [username, email, fullName, passwordHash]
      );
      results.push({ email, fullName, username, generatedPassword: password, status: 'created' });
      created++;
    } catch (error: any) {
      const reason = error.code === 'ER_DUP_ENTRY'
        ? 'Email already exists'
        : (error instanceof Error ? error.message : 'Unknown error');
      results.push({ email, fullName, username, generatedPassword: '', status: 'skipped', reason });
      skipped++;
    }
  }

  return res.status(201).json({
    success: true,
    summary: { total: entries.length, created, skipped },
    results,
  });
});

// ---------- DELETE invigilator ----------
router.delete('/invigilators/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid invigilator ID' });
  }
  try {
    const result = (await exec(
      `DELETE FROM users WHERE id = ? AND role = 'invigilator'`,
      [id]
    )) as any;
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Invigilator not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete invigilator';
    return res.status(500).json({ message });
  }
});

// ---------- RESET/REISSUE PASSWORD ----------
router.post('/invigilators/:id/reset-password', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid invigilator ID' });
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = (await exec(
      `UPDATE users
       SET password_hash = ?, is_active = 1, deleted_at = NULL
       WHERE id = ? AND role = 'invigilator'`,
      [passwordHash, id]
    )) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Invigilator not found' });
    }

    return res.json({ success: true, generatedPassword: password });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset invigilator password';
    return res.status(500).json({ message });
  }
});

export default router;
