# Mtchedlo777 V1.1

## Website
Upload index.html, style.css, app.js, activity.js, config.js and assets/ to the public GitHub repository `ereklemtchedlishvili71-png.github.io`. Enable Pages from main / root. Do not upload any secrets. Existing Spotify playlist and video are unchanged.

## Discord + Spotify presence
1. Discord Settings > Advanced > Developer Mode. Right-click your profile (mobile: open profile menu) and Copy User ID.
2. Join https://discord.gg/lanyard and remain a member. Enable Discord activity sharing. For Spotify, connect Spotify under Discord Connections and enable Display Spotify as your status.
3. Put the numeric ID in `discordUserId` in config.js. Presence refreshes every 20 seconds. It shows only activities Discord actually shares; the playlist embed is separate.

## Global views and streaming backend
Install Node.js and run the commands below from the backend folder. Create a Cloudflare account if necessary.

```sh
npx wrangler login
npx wrangler d1 create mtchedlo777
```
Replace `REPLACE_WITH_D1_DATABASE_ID` in wrangler.toml with the returned database UUID. Then:

```sh
npx wrangler d1 execute mtchedlo777 --remote --file=schema.sql
npx wrangler deploy
```
Copy the deployed HTTPS Worker URL into `apiBase` in config.js and publish the updated config to GitHub Pages. If using a custom domain, change SITE_ORIGIN in wrangler.toml and redeploy. Counts are global across browsers, increment once per browser tab session (sessionStorage); not verified unique people or bot-resistant. No visitor IPs are stored. Missing backend displays a dash rather than a fabricated count.

## YouTube live
Enable YouTube Data API v3 in Google Cloud, create an API key restricted to that API, and from backend run `npx wrangler secret put YOUTUBE_API_KEY`. Paste the key only into the terminal prompt. The worker resolves @vajashavela and checks every 30 minutes (48 searches/day). Status is unknown until the first successful check, and expires if updates stop. Optional YOUTUBE_CHANNEL_ID can be set in wrangler.toml [vars]. Quota and external availability apply.

## TikTok live (manual)
No automated TikTok live API is bundled. To update your own status, run `npx wrangler secret put ADMIN_TOKEN` and set a long random password. From a terminal, substitute the Worker URL and your token in the following example (never put the token in public config.js):

```sh
curl -X POST https://YOUR-WORKER.workers.dev/admin/tiktok -H 'Authorization: Bearer YOUR_TOKEN' -H 'Content-Type: application/json' -d '{"status":"live","hours":3}'
```
Use `offline` when finished; a status expires automatically after the chosen duration (1–24 hours). Before setup or after expiration, it does not claim that you are live/offline. This is owner-managed, not automatic detection.

Spotify embed playback depends on Spotify and browser policy. No copied audio files. External services require internet access. The Minecraft skin is a floating 2D render. Backend and real account integration require deployment and configuration; JavaScript syntax checked, not end-to-end tested against live credentials.
