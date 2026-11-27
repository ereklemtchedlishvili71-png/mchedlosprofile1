(()=>{
const $=id=>document.getElementById(id),form=$('owner-login-form'),password=$('owner-password'),result=$('owner-login-result'),dashboard=$('owner-dashboard'),login=$('owner-login');
const base=(window.PROFILE_CONFIG?.apiBase||'').replace(/\/+$/,'');
let timer;
function lock(){clearTimeout(timer);$('token').value='';password.value='';dashboard.hidden=true;dashboard.inert=true;login.hidden=false;location.reload();}
form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;result.textContent='Checking password…';try{if(!base.startsWith('https://'))throw Error('API is not configured');const value=password.value.trim();const r=await fetch(base+'/hub/admin/login',{method:'POST',headers:{Authorization:'Bearer '+value},cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.status===401)throw Error('Incorrect password');if(r.status===429)throw Error('Too many attempts. Try again later.');if(!r.ok||!(await r.json()).ok)throw Error('Login service unavailable');$('token').value=value;password.value='';result.textContent='';login.hidden=true;dashboard.hidden=false;dashboard.inert=false;timer=setTimeout(lock,30*60*1000);}catch(e){result.textContent=e.message;password.value='';password.focus();}finally{button.disabled=false;}});
$('clear-token').addEventListener('click',lock);window.addEventListener('pagehide',()=>{$('token').value='';dashboard.hidden=true;dashboard.inert=true;login.hidden=false;});
})();
