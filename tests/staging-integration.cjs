const assert = require('node:assert/strict');
process.env.AEGIS_MODE = 'staging';
process.env.SUPABASE_URL = 'https://isolated-project.supabase.co';
process.env.SUPABASE_KEY = 'test-service-key';
process.env.AEGIS_ROUTER_URL = 'https://staging-router.example';
process.env.TARGETS = JSON.stringify([{name:'render',url:'https://stage.example/health',region:'staging',enabled:true}]);
process.env.GITHUB_TOKEN='must-not-be-used';process.env.GITHUB_REPO='example/example';process.env.ALERT_WEBHOOK_URL='https://webhook.example';
const calls=[]; const checks=[];let incidentRows=[];
global.fetch=async (u, opts={}) => {
 const url=String(u),method=opts.method||'GET';calls.push([url,method]);
 if(url==='https://stage.example/health') return Response.json({status:'ok',cloud:'render'});
 if(url==='https://staging-router.example/health') return Response.json({status:'ok',cloud:'render'});
 if(url==='https://staging-router.example/router/health') return Response.json({targets:[{name:'render',healthy:true}]});
 if(url.startsWith('https://isolated-project.supabase.co/rest/v1/')) {
  if(url.includes('/health_checks') && method==='POST'){checks.push(...JSON.parse(opts.body));return new Response(null,{status:204});}
  if(url.includes('/health_checks'))return Response.json(checks);
  if(url.includes('/incidents'))return Response.json(incidentRows);
  return Response.json([]);
 }
 return new Response('',{status:404});
};
(async()=>{
 const m=require('../orchestration/monitor'); const data=require('../web/data');
 const result=await m.main();assert.equal(result.results.length,1);assert.equal(checks.length,1);assert.equal(checks[0].healthy,true);
 const snapshot=await data.provideSnapshot();assert.equal(snapshot.diagnostics.targetSource,'environment.staging');assert.equal(snapshot.diagnostics.historyAvailable,true);assert.equal(snapshot.diagnostics.historyRows,1);assert.equal(snapshot.router.serving,'render');
 assert(!calls.some(([url])=>url.includes('kagjbxxmdyaypfcqemem') || url.includes('aegis-platform-pomf.onrender.com') || url.includes('aegis-platform-11f7.vercel.app') || url.includes('aegis-router.manav32478.workers.dev') || url.includes('webhook.example') || url.includes('api.github.com')));
 assert(!calls.some(([url])=>url.includes('/monitor_targets')));console.log('staging monitor + portal snapshot mock integration passed');
})().catch(e=>{console.error(e);process.exit(1)});
