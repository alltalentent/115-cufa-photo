/**
 * CUFA PHOTO CONTROL — Cloudflare Worker CORS + Google ContentService redirect bridge.
 * Deployment: Cloudflare Workers > Create Worker > paste this file > Deploy.
 * Endpoint is public; Google Apps Script validates ADMIN_PASSWORD for EVERY operation.
 */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzqx0mUeEY7igo9d5023GEP7nsEV1haaTqqSvJ233BwfqEvLwhluQGWZBOZuic1ecynCA/exec';
const ALLOWED_ORIGIN = 'https://alltalentent.github.io';
const headers = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Vary': 'Origin'
};
function json(payload, status=200){return new Response(JSON.stringify(payload),{status,headers})}
export default {
  async fetch(request) {
    const origin=request.headers.get('Origin');
    if(origin&&origin!==ALLOWED_ORIGIN)return json({ok:false,error:'Origin not allowed'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json({ok:false,error:'POST only'},405);
    let raw,payload;
    try {
      raw=await request.text();
      if(raw.length>20000)return json({ok:false,error:'Request too large'},413);
      payload=JSON.parse(raw);
      if(!['getDashboard','apiAction'].includes(payload.action))return json({ok:false,error:'Unknown action'},400);
      if(typeof payload.password!=='string'||!payload.password)return json({ok:false,error:'Missing password'},400);
    } catch(e){return json({ok:false,error:'Invalid JSON'},400)}
    try {
      // Server-side request avoids browser CORS to script.google.com.
      const response=await fetch(GAS_URL,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:raw,
        redirect:'follow',
        signal:AbortSignal.timeout(25000)
      });
      const text=await response.text();
      let result;
      try{result=JSON.parse(text)}
      catch(e){return json({ok:false,error:'Google Apps Script did not return JSON. Check anonymous access and deployment.'},502)}
      return json(result,response.ok?200:502);
    }catch(e){
      return json({ok:false,error:'Google Apps Script upstream unavailable: '+String(e.message||e)},502);
    }
  }
};
