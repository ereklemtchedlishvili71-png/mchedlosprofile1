const now = () => Math.floor(Date.now() / 1000);

async function save(env, platform, status, ttl) {
    await env.DB.prepare(`
        INSERT INTO streams VALUES (?, ?, ?, ?)
        ON CONFLICT(platform) DO UPDATE SET
            status = excluded.status,
            updated = excluded.updated,
            expires = excluded.expires
    `).bind(
        platform, status, now(), now() + ttl
    ).run();
}

async function youtubeRequest(endpoint, params, env) {
    const query = new URLSearchParams({
        ...params,
        key: env.YOUTUBE_API_KEY
    });

    const response = await fetch(
        'https://www.googleapis.com/youtube/v3/' +
        endpoint + '?' + query
    );

    const data = await response.json();

    if (!response.ok) {
        const reason =
            data.error?.errors?.[0]?.reason ||
            'api_error';

        throw new Error(
            `YouTube API: ${response.status} - ${reason}`
        );
    }

    return data;
}

async function youtube(env) {
    if (!env.YOUTUBE_API_KEY) {
        console.error('[YouTube] API key is missing');
        return { status: 'unconfigured' };
    }

    try {
        let id = env.YOUTUBE_CHANNEL_ID;

        if (!id) {
            const data = await youtubeRequest(
                'channels',
                {
                    part: 'id',
                    forHandle: '@vajashavela'
                },
                env
            );

            id = data.items?.[0]?.id;
        }

        if (!id) {
            throw new Error('YouTube channel not found');
        }

        console.log('[YouTube] Channel ID:', id);

        const data = await youtubeRequest(
            'search',
            {
                part: 'id',
                channelId: id,
                type: 'video',
                eventType: 'live',
                maxResults: '1'
            },
            env
        );

        const status = data.items?.length
            ? 'live'
            : 'offline';

        await save(env, 'youtube', status, 2100);

        console.log('[YouTube] Status:', status);

        return { status };

    } catch (error) {
        console.error(
            '[YouTube] Error:',
            error.message
        );

        await save(env, 'youtube', 'unknown', 2100);

        return { status: 'unknown' };
    }
}

export default {
    async scheduled(event, env, ctx) {
        console.log('[Cron] Checking YouTube status');
        ctx.waitUntil(youtube(env));
    },

    async fetch(req, env) {
        const origin = req.headers.get('Origin');

        const allowed = env.SITE_ORIGIN ||
            'https://ereklemtchedlishvili71-png.github.io';

        const headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Vary': 'Origin',
            'Access-Control-Allow-Methods':
                'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers':
                'Content-Type, Authorization'
        };

        if (origin === allowed) {
            headers['Access-Control-Allow-Origin'] = origin;
        }

        const json = (value, status = 200) =>
            new Response(JSON.stringify(value), {
                status,
                headers
            });

        if (origin && origin !== allowed) {
            return json({ error: 'Origin not allowed' }, 403);
        }

        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers
            });
        }

        const path = new URL(req.url).pathname;

        const isAdmin = () =>
            env.ADMIN_TOKEN &&
            req.headers.get('Authorization') ===
                'Bearer ' + env.ADMIN_TOKEN;

        try {
            if (
                path === '/views' &&
                ['GET', 'POST'].includes(req.method)
            ) {
                if (req.method === 'POST') {
                    if (origin !== allowed) {
                        return json(
                            { error: 'Origin required' },
                            403
                        );
                    }

                    const row = await env.DB.prepare(`
                        UPDATE counters
                        SET value = value + 1
                        WHERE id = 'profile'
                        RETURNING value
                    `).first();

                    return json({ views: row.value });
                }

                const row = await env.DB.prepare(`
                    SELECT value FROM counters
                    WHERE id = 'profile'
                `).first();

                return json({ views: row.value });
            }

            if (
                path === '/streams' &&
                req.method === 'GET'
            ) {
                const { results } = await env.DB.prepare(
                    'SELECT * FROM streams'
                ).all();

                const out = {
                    youtube: {
                        status: env.YOUTUBE_API_KEY
                            ? 'unknown'
                            : 'unconfigured'
                    },
                    tiktok: {
                        status: 'unconfigured'
                    }
                };

                for (const row of results) {
                    if (row.platform in out) {
                        out[row.platform] = {
                            status: row.expires > now()
                                ? row.status
                                : 'unknown',
                            updated: row.updated
                        };
                    }
                }

                return json(out);
            }

            if (
                path === '/admin/youtube/refresh' &&
                req.method === 'POST'
            ) {
                if (!isAdmin()) {
                    return json(
                        { error: 'Unauthorized' },
                        401
                    );
                }

                return json(await youtube(env));
            }

            if (
                path === '/admin/tiktok' &&
                req.method === 'POST'
            ) {
                if (!isAdmin()) {
                    return json(
                        { error: 'Unauthorized' },
                        401
                    );
                }

                const { status, hours } = await req.json();

                if (!['live', 'offline'].includes(status)) {
                    return json(
                        { error: 'Invalid status' },
                        400
                    );
                }

                const ttl = Math.max(
                    1,
                    Math.min(24, Number(hours) || 3)
                ) * 3600;

                await save(env, 'tiktok', status, ttl);

                return json({ ok: true });
            }

            return json({ error: 'Not found' }, 404);

        } catch (error) {
            console.error('[Worker]', error.message);

            return json(
                { error: 'Service unavailable' },
                503
            );
        }
    }
};