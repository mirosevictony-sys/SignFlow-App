import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createMocks} from 'node-mocks-http';
import {connectDb,migrate} from '../server/db.js';
import {seed} from '../server/seed.js';
import {createApp} from '../server/app.js';
import {hashPassword,hashToken} from '../server/security.js';
import {defaultLine} from '../shared/costing.js';

test('persistent domain workflows, release gates, permissions and concurrency',async t=>{
  process.env.DATABASE_MODE='embedded';process.env.EMBEDDED_PATH='memory://';
  const db=await connectDb();await migrate(db);await seed(db);const app=createApp(db);
  const call=async(method:string,url:string,body:unknown=undefined,cookie='',headers:Record<string,string>={})=>{
    const {req,res}=createMocks({method:method as any,url,body:body as any,headers:{host:'localhost:3000',...(body===undefined?{}:{'content-type':'application/json','content-length':String(Buffer.byteLength(JSON.stringify(body)))}),...(cookie?{cookie}:{}),...headers}},{eventEmitter:EventEmitter});
    // The HTTP adapter supplies an already consumed, parsed request stream.
    Object.assign(req,{complete:true,readable:false});
    await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(`Timed out: ${method} ${url}`)),5000);res.on('end',()=>{clearTimeout(timeout);resolve();});app(req,res);});
    return {status:res.statusCode,body:res._getJSONData(),cookies:res.cookies};
  };
  const login=async(email:string,password:string)=>{const r=await call('POST','/api/auth/login',{email,password});assert.equal(r.status,200,JSON.stringify(r.body));return 'signflow_session='+r.cookies.signflow_session.value;};
  const admin=await login('tony@signflow.local','SignFlow-Demo-2026!'),operator=await login('operator@signflow.local','Operator-Demo-2026!');
  const getJob=async(jid:string)=>(await call('GET',`/api/jobs/${jid}`,undefined,admin)).body;
  const action=async(jid:string,action:string,more:Record<string,unknown>={},cookie=admin)=>call('POST',`/api/jobs/${jid}/action`,{version:(await getJob(jid)).version,action,...more},cookie);
  try{
    await t.test('migrations and seed are idempotent',async()=>{await migrate(db);await seed(db);const b=(await call('GET','/api/bootstrap',undefined,admin)).body;assert.equal(b.customers.length,12);assert.equal(b.quotes.length,14);assert.equal(b.orders.length,8);assert.equal(b.jobs.length,16);assert.equal(b.machines.length,5);});
    await t.test('authentication, role checks, cost redaction and CSRF protection',async()=>{
      assert.equal((await call('GET','/api/bootstrap')).status,401);
      assert.equal((await call('POST','/api/auth/login',{email:'tony@signflow.local',password:'wrong'})).status,401);
      assert.equal((await call('GET','/api/quotes/quote-1',undefined,operator)).status,403);
      const b=(await call('GET','/api/bootstrap',undefined,operator)).body;assert.equal(b.quotes.length,0);assert.equal(b.orders[0].total_cents,undefined);assert.equal(b.machines[0].hourly_rate,undefined);assert.equal(b.company.settings.labourRate,undefined);
      assert.equal((await call('GET','/api/jobs/job-1',undefined,operator)).body.snapshot.cost,undefined);
      assert.equal((await action('job-2','approve',{},operator)).status,403);
      assert.equal((await call('POST','/api/auth/logout',{},admin,{origin:'https://untrusted.example'})).status,403);
    });
    await t.test('customer create and edit persist',async()=>{const input={name:'Test customer',contact:'Test contact',email:'test@example.com',phone:'',address:'Dublin',sector:'Commercial',terms:30,notes:'Test only'};const c=await call('POST','/api/customers',input,admin);assert.equal(c.status,201);assert.equal((await call('PUT',`/api/customers/${c.body.id}`,{...input,name:'Renamed customer'},admin)).status,200);assert.equal((await db.query('SELECT name FROM customers WHERE id=$1',[c.body.id])).rows[0].name,'Renamed customer');});
    let quoteId='',orderId='',jobId='';
    await t.test('create quote, approve, convert to order and generate one job per line without duplicates',async()=>{
      const input={customerId:'customer-1',title:'Workflow test graphics',dueDate:'2026-10-01',validUntil:'2026-10-10',notes:'QA',lines:[{...defaultLine,quantity:5}]};
      assert.equal((await call('POST','/api/quotes',{...input,lines:[{...defaultLine,sell:1}]},admin)).status,400);
      const q=await call('POST','/api/quotes',input,admin);assert.equal(q.status,201,JSON.stringify(q.body));quoteId=q.body.id;
      assert.equal((await call('PUT',`/api/quotes/${quoteId}`,{...input,title:'Edited workflow test'},admin)).status,200);assert.equal((await call('GET',`/api/quotes/${quoteId}`,undefined,admin)).body.title,'Edited workflow test');
      assert.equal((await call('POST',`/api/quotes/${quoteId}/convert`,{},admin)).status,409);
      for(const status of ['Sent','Accepted'])assert.equal((await call('POST',`/api/quotes/${quoteId}/status`,{status},admin)).status,200);
      assert.equal((await call('PUT',`/api/quotes/${quoteId}`,input,admin)).status,409);
      const orders=await Promise.all([call('POST',`/api/quotes/${quoteId}/convert`,{},admin),call('POST',`/api/quotes/${quoteId}/convert`,{},admin)]);assert.equal(orders[0].status,201);assert.equal(orders[0].body.id,orders[1].body.id);orderId=orders[0].body.id;
      const first=await call('POST',`/api/orders/${orderId}/jobs`,{},admin),second=await call('POST',`/api/orders/${orderId}/jobs`,{},admin);assert.equal(first.status,201);assert.equal(first.body.jobs.length,1);assert.equal(first.body.jobs[0].id,second.body.jobs[0].id);jobId=first.body.jobs[0].id;
      assert.equal((await getJob(jobId)).ordered,5);
    });
    await t.test('artwork, material, deposit and machine conflicts are enforced',async()=>{
      assert.equal((await action(jobId,'advance')).status,409);assert.equal((await action(jobId,'approve')).status,200);assert.equal((await action(jobId,'advance')).status,200);assert.equal((await getJob(jobId)).department,'Production');
      await action(jobId,'materials');assert.equal((await action(jobId,'start')).status,409);await action(jobId,'materials');
      await db.query("UPDATE companies SET settings=jsonb_set(settings,'{requireDeposit}','true') WHERE id='connect-install'");assert.equal((await action(jobId,'start')).status,409);await db.query('UPDATE orders SET deposit_paid=true WHERE id=$1',[orderId]);
      assert.equal((await action(jobId,'start')).status,409);assert.equal((await action('job-1','pause')).status,200);assert.equal((await action(jobId,'start')).status,200);
    });
    await t.test('partial production, invalid output and stale updates do not corrupt quantities',async()=>{
      assert.equal((await action(jobId,'output',{good:6},operator)).status,400);
      assert.equal((await action(jobId,'output',{good:2,rejected:1},operator)).status,400);
      const version=(await getJob(jobId)).version;
      const concurrent=await Promise.all([call('POST',`/api/jobs/${jobId}/action`,{action:'output',version,good:2,rejected:1,note:'Banding test'},operator),call('POST',`/api/jobs/${jobId}/action`,{action:'output',version,good:2,rejected:1,note:'Duplicate'},operator)]);assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
      assert.equal((await getJob(jobId)).produced,2);assert.equal((await getJob(jobId)).rejected,1);assert.equal((await action(jobId,'advance')).status,409);
      assert.equal((await action(jobId,'output',{good:3},operator)).status,200);assert.equal((await action(jobId,'advance')).status,200);assert.equal((await getJob(jobId)).department,'Finishing');
      assert.equal((await action(jobId,'advance')).status,200);assert.equal((await action(jobId,'advance')).status,409);assert.equal((await action(jobId,'deliver',{good:6})).status,400);assert.equal((await action(jobId,'deliver',{good:5})).status,200);assert.equal((await action(jobId,'advance')).status,200);assert.equal((await action(jobId,'advance')).status,200);assert.equal((await getJob(jobId)).state,'Complete');
      assert.equal((await call('GET',`/api/orders/${orderId}`,undefined,admin)).body.status,'Completed');
    });
    await t.test('new artwork invalidates approval and holds work',async()=>{const j=await getJob('job-3');assert.equal(j.artwork_approved,true);assert.equal((await action(j.id,'revise')).status,200);const after=await getJob(j.id);assert.equal(after.artwork_version,2);assert.equal(after.artwork_approved,false);assert.equal(after.state,'Blocked');});
    await t.test('company boundaries and server checks reject foreign references',async()=>{
      await db.query("INSERT INTO companies(id,name) VALUES('other','Other company')");await db.query('INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)',['other-user','other','Other user','other@example.com',hashPassword('OtherPassword-2026!'),'admin']);const other=await login('other@example.com','OtherPassword-2026!');
      assert.equal((await call('GET',`/api/jobs/${jobId}`,undefined,other)).status,404);assert.equal((await call('GET',`/api/orders/${orderId}`,undefined,other)).status,404);assert.equal((await call('GET',`/api/quotes/${quoteId}`,undefined,other)).status,404);
      assert.equal((await call('POST','/api/quotes',{customerId:'customer-1',title:'Foreign reference',dueDate:'2026-10-01',validUntil:'2026-10-10',notes:'',lines:[defaultLine]},other)).status,400);
    });
    await t.test('audit history exists, accepted cost snapshots persist and logout revokes sessions',async()=>{
      const before=(await call('GET',`/api/quotes/${quoteId}`,undefined,admin)).body;
      const b=(await call('GET','/api/bootstrap',undefined,admin)).body;assert.equal((await call('PUT','/api/settings',{name:b.company.name,settings:{...b.company.settings,labourRate:60}},admin)).status,200);
      const after=(await call('GET',`/api/quotes/${quoteId}`,undefined,admin)).body;assert.equal(before.total_cents,after.total_cents);assert.deepEqual(before.lines,after.lines);assert.ok(Number((await db.query('SELECT count(*) n FROM audit_log')).rows[0].n)>10);
      assert.equal((await call('POST','/api/auth/logout',{},operator)).status,200);assert.equal((await call('GET','/api/bootstrap',undefined,operator)).status,401);
    });
  }finally{await db.close();}
});
