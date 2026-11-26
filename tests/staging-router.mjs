import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../orchestration/router/src/staging-worker.js',import.meta.url),'utf8');
let seq=0;
const fresh=async()=> (await import('data:text/javascript;base64,'+Buffer.from(src+'\n// '+ ++seq).toString('base64'))).default;
const target=[{name:'render',url:'https://a.test'},{name:'vercel',url:'https://b.test'}];
let env={TARGETS:JSON.stringify(target)};
let calls=[];let healthA=true,healthB=true,actionA='ok',actionB='ok',delayA=0,delayB=0;
const originalNow=Date.now; let offset=0; Date.now=()=>originalNow()+offset;
globalThis.fetch=async (url,init={})=>{url=String(url);const a=url.startsWith('https://a.test'),health=url.endsWith('/health');calls.push([url,init.method||'GET']); if(health){const delay=a?delayA:delayB;if(delay)await new Promise(r=>setTimeout(r,delay));return new Response('',{status:(a?healthA:healthB)?200:503});}const action=a?actionA:actionB;if(action==='throw')throw Error('offline');return new Response(a?'a':'b',{status:action==='fail'?503:200});};
let w=await fresh(),r=await w.fetch(new Request('https://router.test/'),{});assert.equal(r.status,503);
r=await w.fetch(new Request('https://router.test/'),{TARGETS:JSON.stringify([{name:'live',url:'https://aegis-platform-pomf.onrender.com'}])});assert.equal(r.status,503);
// Unhealthy configured primary -> secondary responds; no network call to unhealthy primary for content.
healthA=false;w=await fresh();calls=[];r=await w.fetch(new Request('https://router.test/'),env);assert.equal(await r.text(),'b');assert(!calls.some(x=>x[0]==='https://a.test/'));
// GET 5xx is retried safely while POST never retries even on 5xx or thrown request.
healthA=true;actionA='fail';w=await fresh();calls=[];r=await w.fetch(new Request('https://router.test/page'),env);assert.equal(await r.text(),'b');assert(calls.some(x=>x[0]==='https://b.test/page'));
calls=[];r=await w.fetch(new Request('https://router.test/form',{method:'POST',body:'test'}),env);assert.equal(r.status,503);assert(!calls.some(x=>x[0]==='https://b.test/form'));
actionA='throw';calls=[];r=await w.fetch(new Request('https://router.test/form',{method:'POST',body:'test'}),env);assert.equal(r.status,502);assert(!calls.some(x=>x[0]==='https://b.test/form'));
// With latency mode, switch requires repeated meaningful improvements, not one sample.
actionA='ok';delayA=0;delayB=0;w=await fresh();env.ROUTING_MODE='latency';r=await w.fetch(new Request('https://router.test/router/health'),env);assert.equal((await r.json()).selected,'render');
delayA=80;delayB=2;offset+=11000;r=await w.fetch(new Request('https://router.test/router/health'),env);assert.equal((await r.json()).selected,'render');
let selected;for(let i=0;i<9;i++){offset+=11000;r=await w.fetch(new Request('https://router.test/router/health'),env);selected=(await r.json()).selected;if(selected==='vercel')break;}
assert.equal(selected,'vercel');Date.now=originalNow;
console.log('staging router safety and hysteresis tests passed');
