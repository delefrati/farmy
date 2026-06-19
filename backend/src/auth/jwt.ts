import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthUser;
};

const JWT_SECRET = process.env.JWT_SECRET || 'farmy-dev-secret-change-me';

export const issueAuthToken = (user: AuthUser): string => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
};

const parseBearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = parseBearerToken(req.header('authorization'));
  if (!token) {
    res.status(401).json({ success: false, error: 'auth_required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const id = typeof decoded.id === 'string' ? decoded.id : null;
    const email = typeof decoded.email === 'string' ? decoded.email : null;

    if (!id || !email) {
      res.status(401).json({ success: false, error: 'invalid_auth_token' });
      return;
    }

    (req as AuthenticatedRequest).user = { id, email };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'invalid_auth_token' });
  }
};
