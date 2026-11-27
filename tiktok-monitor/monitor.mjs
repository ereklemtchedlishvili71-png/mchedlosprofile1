import { createServer } from 'node:http';
import * as lib from 'tiktok-live-connector';
const user = process.env.TIKTOK_USERNAME || 'vajashavelamc';
const base = (process.env.API_BASE || 'https://mchedlosprofile1.ereklemtchedlishvili71.workers.dev').replace(/\/+$/, '');
const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error('ADMIN_TOKEN is required');
if (!base.startsWith('https://')) throw new Error('HTTPS API_BASE required');
const Connection = lib.TikTokLiveConnection || lib.WebcastPushConnection;
if (!Connection) throw new Error('Unsupported connector version');
let last = {status:'unknown', checkedAt:null};
async function check(){
  const client = new Connection(user);
  const live = await client.fetchIsLive();
  if(typeof live !== 'boolean') throw new Error('Unexpected LIVE response');
  const status = live ? 'live' : 'offline';
  const response = await fetch(`${base}/admin/tiktok`, {method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({status,hours:1}),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`Cloudflare HTTP ${response.status}`);
  if((await response.json()).ok !== true) throw new Error('Cloudflare did not confirm update');
  last = {status,checkedAt:new Date().toISOString()};
  console.log(`[monitor] ${status} ${last.checkedAt}`);
}
async function loop(){
  let timer;
  try { await Promise.race([check(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Check timeout')),45000)})]); }
  catch { last={status:'unknown',checkedAt:new Date().toISOString()}; console.error('[monitor] Check failed; existing website status left unchanged'); }
  finally {clearTimeout(timer);setTimeout(loop,60000);}
}
createServer((req,res)=>{if(req.url!=='/health'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(last));}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>{console.log('[monitor] started');loop();});
