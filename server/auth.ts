import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config';

const supabaseAdmin = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BYPASS_PATHS = new Set<string>([
  '/api/auth/send-confirmation-email',
  '/api/auth/confirm-email',
  '/api/stripe/webhook',
]);

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (BYPASS_PATHS.has(req.path)) {
      return next();
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    (req as any).user = data.user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}



