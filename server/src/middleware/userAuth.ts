import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email?: string;
        phone?: string;
    };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            phone: user.phone
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
};
