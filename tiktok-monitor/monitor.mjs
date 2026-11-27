import { createServer } from 'node:http';
import * as lib from 'tiktok-live-connector';

const user = (
    process.env.TIKTOK_USERNAME || 'vajashavelamc'
).replace(/^@/, '');

const base = (
    process.env.API_BASE ||
    'https://mchedlosprofile1.ereklemtchedlishvili71.workers.dev'
).replace(/\/+$/, '');

const token = process.env.ADMIN_TOKEN?.trim();

if (!token) {
    throw new Error('ADMIN_TOKEN is required');
}

if (!base.startsWith('https://')) {
    throw new Error('HTTPS API_BASE required');
}

const Connection =
    lib.TikTokLiveConnection ||
    lib.WebcastPushConnection;

if (!Connection) {
    throw new Error('Unsupported connector version');
}

let last = {
    status: 'unknown',
    checkedAt: null
};

async function check() {
    console.log(`[TikTok] Checking @${user}`);

    const client = new Connection(user, {});

    if (typeof client.fetchIsLive !== 'function') {
        throw new Error('fetchIsLive is not supported');
    }

    const live = await client.fetchIsLive();

    if (typeof live !== 'boolean') {
        throw new Error('Unexpected LIVE response');
    }

    const status = live ? 'live' : 'offline';

    console.log(`[TikTok] Detected status: ${status}`);
    console.log('[Cloudflare] Updating status...');

    const response = await fetch(
        `${base}/admin/tiktok`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status,
                hours: 1
            }),
            signal: AbortSignal.timeout(15000)
        }
    );

    if (!response.ok) {
        throw new Error(
            `Cloudflare HTTP ${response.status}`
        );
    }

    const result = await response.json();

    if (result.ok !== true) {
        throw new Error(
            'Cloudflare did not confirm update'
        );
    }

    last = {
        status,
        checkedAt: new Date().toISOString()
    };

    console.log(
        `[SUCCESS] ${user}: ${status}`
    );
}

async function loop() {
    try {
        await check();

    } catch (error) {
        last = {
            status: 'unknown',
            checkedAt: new Date().toISOString()
        };

        const message = String(
            error.message || error
        )
            .split(token).join('[REDACTED]')
            .replace(/https?:\/\/\S+/g, '[URL]');

        console.error(
            '[monitor] Error type:',
            error.name
        );

        console.error(
            '[monitor] Error:',
            message
        );

        console.log(
            '[monitor] Existing status unchanged'
        );

    } finally {
        setTimeout(loop, 60000);
    }
}

createServer((req, res) => {
    const path = new URL(
        req.url || '/',
        'http://localhost'
    ).pathname;

    if (path !== '/health' && path !== '/') {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    });

    res.end(JSON.stringify({
        service: 'Mtchedlo777 TikTok Monitor',
        username: user,
        ...last
    }));

}).listen(
    Number(process.env.PORT || 3000),
    '0.0.0.0',
    () => {
        console.log('[monitor] Started V1.3.1');
        loop();
    }
);