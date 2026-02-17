
import { generateSitemap } from './_lib/controllers/seoController';

export default async function handler(req, res) {
    // Vercel Serverless Function wrapper
    // We reuse the controller logic which is compatible (req, res)
    return generateSitemap(req, res);
}
