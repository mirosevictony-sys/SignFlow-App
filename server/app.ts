import express from 'express';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import type {Database} from './db.js';
import {auth,csrf,fail,financial,hashToken,HttpError,roles,sessionCookie,verifyPassword} from './security.js';
import {registerSales} from './routes/sales.js';
import {registerProduction} from './routes/production.js';
export function createApp(db:Database){
  const app=express();app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"});next();});
  app.use(express.json({limit:'512kb'}));app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();},csrf);
  app.get('/api/health',async(_req,res)=>{await db.query('SELECT 1');res.json({status:'ok',app:'SignFlow',version:'0.1.0'});});
  const attempts=new Map<string,{count:number;until:number}>();
  app.post('/api/auth/login',async(req,res)=>{
    const input=z.object({email:z.string().email().max(254),password:z.string().min(1).max(200)}).parse(req.body);
    const key=req.ip||'local';const now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
    const limit=attempts.get(key);if(limit&&limit.count>=10)fail(429,'Too many attempts. Try again in 15 minutes.');
    attempts.set(key,{count:(limit?.count||0)+1,until:limit?.until||now+900000});
    const r=await db.query('SELECT * FROM users WHERE email=$1',[input.email.toLowerCase()]);
    if(!r.rows[0]||!verifyPassword(input.password,r.rows[0].password_hash))fail(401,'Email or password is incorrect.');
    attempts.delete(key);const token=randomBytes(32).toString('hex');
    await db.query('DELETE FROM sessions WHERE expires_at<now()');
    await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[hashToken(token),r.rows[0].id]);sessionCookie(res,token);res.json({ok:true});
  });
  app.use('/api',auth(db));
  app.post('/api/auth/logout',async(req,res)=>{const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('signflow_session='))?.slice(17);if(token)await db.query('DELETE FROM sessions WHERE token_hash=$1',[hashToken(token)]);sessionCookie(res,'',0);res.json({ok:true});});
  app.get('/api/bootstrap',async(req,res)=>{
    const cid=req.user.company_id;const canFinance=financial(req.user);
    const [company,customers,quotes,orders,jobs,machines,activity]=await Promise.all([
      db.query('SELECT * FROM companies WHERE id=$1',[cid]),db.query('SELECT * FROM customers WHERE company_id=$1 ORDER BY name',[cid]),
      canFinance?db.query('SELECT q.*,c.name customer_name FROM quotes q JOIN customers c ON c.id=q.customer_id WHERE q.company_id=$1 ORDER BY q.created_at DESC',[cid]):Promise.resolve({rows:[]}),
      db.query('SELECT o.*,c.name customer_name,q.number quote_number,(SELECT count(*)::int FROM jobs j WHERE j.order_id=o.id) job_count FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN quotes q ON q.id=o.quote_id WHERE o.company_id=$1 ORDER BY o.created_at DESC',[cid]),
      db.query('SELECT j.*,c.name customer_name,o.number order_number,o.site,m.name machine_name FROM jobs j JOIN customers c ON c.id=j.customer_id JOIN orders o ON o.id=j.order_id LEFT JOIN machines m ON m.id=j.machine_id WHERE j.company_id=$1 ORDER BY j.due_date,j.number',[cid]),
      db.query('SELECT * FROM machines WHERE company_id=$1 ORDER BY id',[cid]),
      db.query('SELECT e.*,j.number job_number FROM job_events e JOIN jobs j ON j.id=e.job_id WHERE e.company_id=$1 ORDER BY e.created_at DESC LIMIT 12',[cid])
    ]);
    if(!canFinance){for(const o of orders.rows)delete o.total_cents;for(const m of machines.rows)delete m.hourly_rate;const s=company.rows[0].settings;company.rows[0].settings={currency:s.currency,timezone:s.timezone,requireArtwork:s.requireArtwork,requireMaterial:s.requireMaterial,requireDeposit:s.requireDeposit};}
    res.set('Cache-Control','no-store').json({user:req.user,company:company.rows[0],customers:customers.rows,quotes:quotes.rows,orders:orders.rows,jobs:jobs.rows,machines:machines.rows,activity:activity.rows});
  });
  registerSales(app,db);registerProduction(app,db);
  app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
  app.use(express.static(path.resolve('dist/client')));
  app.get('/{*splat}',(_req,res)=>res.sendFile(path.resolve('dist/client/index.html')));
  app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    if(err instanceof z.ZodError)return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});
    if(err instanceof HttpError)return res.status(err.status).json({error:err.message});
    if(err instanceof SyntaxError)return res.status(400).json({error:'Invalid JSON request.'});
    console.error(err);res.status(500).json({error:'The request could not be saved. Please retry.'});
  });
  return app;
}
