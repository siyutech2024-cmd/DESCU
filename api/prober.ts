import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.status(200).json({
        status: 'Alive',
        time: new Date().toISOString(),
        message: 'Vercel is working correctly. The issue is in the main app bundle.'
    });
}
