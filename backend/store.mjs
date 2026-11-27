const now=()=>Math.floor(Date.now()/1000);
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const money=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000000;
const states=['pending','accepted','rejected','awaiting_payment','in_progress','testing','completed','cancelled'];
const paylink=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='keepz.me'||u.hostname.endsWith('.keepz.me'))?u.href:''}catch{return ''}};
export async function store(req,env,json,isAdmin,origin,allowed){
 const p=new URL(req.url).pathname,m=req.method;if(!p.startsWith('/store/'))return null;
 const D=env.DB, first=(s,...a)=>D.prepare(s).bind(...a).first(),all=async(s,...a)=>(await D.prepare(s).bind(...a).all()).results,run=(s,...a)=>D.prepare(s).bind(...a).run();
 const fail=(error,status=400)=>json({error},status);
 if(p.startsWith('/store/admin/')&&!isAdmin())return fail('Unauthorized',401);
 if(m==='POST'&&!p.startsWith('/store/admin/')&&origin!==allowed)return fail('Origin required',403);
 const body=async()=>{const s=await req.text();if(s.length>16000)throw Error('Too large');return JSON.parse(s)};
 if(p==='/store/catalog'&&m==='GET')return json(await all('SELECT * FROM store_services WHERE active=1 ORDER BY category,title'));
 if(p==='/store/order'&&m==='POST'){
  const t=now(),bucket=Math.floor(t/3600),key=await hash((env.ADMIN_TOKEN||'store')+'|'+(req.headers.get('CF-Connecting-IP')||'unknown')+'|'+bucket);const lim=await first('INSERT INTO store_limits VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=hits+1 RETURNING hits',key,(bucket+1)*3600);if(lim.hits>5)return fail('Too many requests',429);await run('DELETE FROM store_limits WHERE expires<?',t);
  const b=await body(),s=await first('SELECT * FROM store_services WHERE id=? AND active=1',clean(b.service,80));const name=clean(b.name,80),contact=clean(b.contact,150),description=clean(b.description,3000),deadline=clean(b.deadline,30),budget=b.budget;
  if(!s||!name||!contact||description.length<10||!money(budget)||b.website)return fail('Invalid order');
  const id=crypto.randomUUID(),secret=crypto.randomUUID()+crypto.randomUUID();await run('INSERT INTO store_orders(id,access_hash,service_id,service_title,name,contact,description,budget,deadline,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,await hash(secret),s.id,s.title,name,contact,description,budget,deadline,t,t);return json({id,secret,status:'pending'},201);
 }
 if(p==='/store/track'&&m==='POST'){const b=await body();const row=await first('SELECT id,service_title,status,amount,payment_url,paid,updated FROM store_orders WHERE id=? AND access_hash=?',clean(b.id,80),await hash(clean(b.secret,150)));if(!row)return fail('Order not found',404);if(row.status!=='awaiting_payment'||row.paid||env.KEEPZ_PAYMENTS_ENABLED!=='true')row.payment_url=null;return json(row);}
 if(p==='/store/admin/orders'&&m==='GET')return json(await all('SELECT id,service_title,name,contact,description,budget,deadline,status,amount,payment_url,payment_ref,paid,created,updated FROM store_orders ORDER BY created DESC LIMIT 200'));
 if(p==='/store/admin/catalog'&&m==='GET')return json(await all('SELECT * FROM store_services ORDER BY category,title'));
 if(p==='/store/admin/catalog'&&m==='POST'){const b=await body(),id=clean(b.id,80),title=clean(b.title,100),category=clean(b.category,40),description=clean(b.description,600);if(!/^[a-z0-9-]+$/.test(id)||!title||!category||!description||!money(b.price))return fail('Invalid service');await run('INSERT INTO store_services VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,description=excluded.description,price=excluded.price,active=excluded.active',id,title,category,description,b.price,b.active===false?0:1);return json({ok:true});}
 if(p==='/store/admin/update'&&m==='POST'){const b=await body(),r=await first('SELECT * FROM store_orders WHERE id=?',clean(b.id,80));if(!r)return fail('Order not found',404);const status=b.status,amount=b.amount,link=clean(b.payment_url,2000),ref=clean(b.payment_ref,100),paid=b.paid===true?1:0;if(!states.includes(status)||!money(amount)||(link&&!paylink(link)))return fail('Invalid update or Keepz URL');if(r.paid&&(amount!==r.amount||paid!==1||ref!==r.payment_ref))return fail('Confirmed payment is immutable');if(status==='awaiting_payment'&&(!link||!ref||amount<=0||env.KEEPZ_PAYMENTS_ENABLED!=='true'))return fail('Enable approved Keepz payments and provide amount, link and reference');if(paid&&!r.paid&&(!ref||amount<=0||env.KEEPZ_PAYMENTS_ENABLED!=='true'))return fail('Payment verification required');if(paid&&status==='awaiting_payment')return fail('Choose a paid order status');if(['in_progress','testing','completed'].includes(status)&&!paid&&amount>0)return fail('Confirm payment first');await D.batch([D.prepare('UPDATE store_orders SET status=?,amount=?,payment_url=?,payment_ref=?,paid=?,updated=? WHERE id=?').bind(status,amount,link||null,ref||null,paid,now(),r.id),D.prepare('INSERT INTO store_audit(order_id,action,created) VALUES(?,?,?)').bind(r.id,`Status ${status}; paid=${paid}; amount=${amount}`,now())]);return json({ok:true});}
 if(p==='/store/admin/audit'&&m==='GET')return json(await all('SELECT * FROM store_audit ORDER BY id DESC LIMIT 200'));
 return fail('Not found',404);
}
