import { Router } from 'express';
import fs from 'fs';
import path from 'path';

/** Diagnostics / health endpoints. */
export const systemRouter = Router();
const router = systemRouter;

// Test Route
router.get('/api/test_ping', (req, res) => {
    const debug: any = {
        pong: true,
        time: new Date().toISOString(),
        location: 'api/_lib/routes/system.ts',
        fs: {}
    };

    try {
        const root = process.cwd();
        debug.fs.cwd = root;

        // Check api folder
        const apiPath = path.join(root, 'api');
        if (fs.existsSync(apiPath)) {
            debug.fs.api = fs.readdirSync(apiPath);

            // Check _lib
            const libPath = path.join(apiPath, '_lib');
            if (fs.existsSync(libPath)) {
                debug.fs.lib = fs.readdirSync(libPath);

                // Check controllers
                const ctrlPath = path.join(libPath, 'controllers');
                if (fs.existsSync(ctrlPath)) {
                    debug.fs.controllers = fs.readdirSync(ctrlPath);
                } else {
                    debug.fs.controllers = 'NOT_FOUND';
                }
            } else {
                debug.fs.lib = 'NOT_FOUND';
            }
        } else {
            debug.fs.api = 'NOT_FOUND';
        }

    } catch (e: any) {
        debug.fs_error = e.message;
    }

    res.json(debug);
});

router.get('/', (req, res) => {
    res.send('DESCU API');
});
