const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const cwd = path.join(__dirname, '..');
const env = { ...process.env, AEGIS_MODE:'staging', SUPABASE_URL:'https://isolated-project.supabase.co', SUPABASE_KEY:'local-testing-key', AEGIS_ROUTER_URL:'https://staging.example', TARGETS:JSON.stringify([{name:'sample',url:'https://sample.example/health',enabled:true}]) };
function run(extra, code) { return spawnSync(process.execPath, ['-e', code || "require('./packages/common/config'); console.log('ok')"], { cwd, env:{ ...env, ...extra }, encoding:'utf8' }); }
test('staging config accepts explicit isolated resources', () => { expect(run().status).toBe(0); });
test.each([
  ['AEGIS_MODE','stagng'],['SUPABASE_URL',''],['SUPABASE_KEY',''],['TARGETS',''],['TARGETS','bad json'],['AEGIS_ROUTER_URL',''],
  ['SUPABASE_URL','https://kagjbxxmdyaypfcqemem.supabase.co'],
  ['AEGIS_ROUTER_URL','https://aegis-router.manav32478.workers.dev'],
  ['TARGETS',JSON.stringify([{name:'live',url:'https://aegis-platform-pomf.onrender.com/health'}])]
])('staging fails closed for invalid or live %s', (key,value) => { expect(run({[key]:value}).status).not.toBe(0); });
test('staging disables notifications and self-heal even if credentials are present', () => {
 const code = `const m=require('./orchestration/monitor'); global.fetch=()=>{throw Error('must not fetch')}; Promise.all([m.maybeSelfHeal([{name:'x',healthy:false}]),m.deliverAlerts({down:['x'],degraded:[]},[{type:'open',cloud:'x'}],[]),m.resolveTargets()]).then(x=>{ if(x[0].length||x[1].events.length||x[2][0].name!=='sample') process.exit(1) }).catch(()=>process.exit(2));`;
 expect(run({GITHUB_TOKEN:'dummy',GITHUB_REPO:'dummy/repo',ALERT_WEBHOOK_URL:'https://example.test'}, code).status).toBe(0);
});
