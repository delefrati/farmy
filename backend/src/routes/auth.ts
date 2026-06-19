import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { issueAuthToken, requireAuth, type AuthenticatedRequest } from '../auth/jwt';

type AuthBody = {
  email?: string;
  password?: string;
};

const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

const isValidEmail = (email: string): boolean => {
  return email.includes('@') && email.length >= 5;
};

export const createAuthRoutes = (pool: Pool): Router => {
  const router = Router();

  router.post('/register', async (req: Request, res: Response): Promise<void> => {
    const body = req.body as AuthBody;
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, error: 'invalid_email' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'password_too_short' });
      return;
    }

    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount && existing.rowCount > 0) {
        res.status(409).json({ success: false, error: 'email_already_registered' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const inserted = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash],
      );

      const user = inserted.rows[0] as { id: string; email: string };
      const token = issueAuthToken({ id: user.id, email: user.email });

      res.status(201).json({
        success: true,
        data: {
          token,
          user,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const body = req.body as AuthBody;
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidEmail(email) || password.length === 0) {
      res.status(400).json({ success: false, error: 'invalid_credentials' });
      return;
    }

    try {
      const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1', [email]);
      if (!result.rowCount || result.rowCount === 0) {
        res.status(401).json({ success: false, error: 'invalid_credentials' });
        return;
      }

      const userRow = result.rows[0] as { id: string; email: string; password_hash: string };
      const isMatch = await bcrypt.compare(password, userRow.password_hash);
      if (!isMatch) {
        res.status(401).json({ success: false, error: 'invalid_credentials' });
        return;
      }

      const token = issueAuthToken({ id: userRow.id, email: userRow.email });
      res.json({
        success: true,
        data: {
          token,
          user: {
            id: userRow.id,
            email: userRow.email,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/me', requireAuth, (req: Request, res: Response): void => {
    const user = (req as AuthenticatedRequest).user;
    res.json({ success: true, data: { user } });
  });

  return router;
};
