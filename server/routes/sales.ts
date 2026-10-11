import type {Express} from 'express';
import {z} from 'zod';
import type {Database} from '../db.js';
import {audit,fail,financial,id,roles} from '../security.js';
import {calculateLine,lineSchema} from '../../shared/costing.js';
const date=z.iso.date();
const customerSchema=z.object({name:z.string().trim().min(2).max(160),contact:z.string().trim().min(2).max(160),email:z.string().email().max(254),phone:z.string().max(50),address:z.string().max(500),sector:z.string().max(60),terms:z.number().int().min(0).max(365),notes:z.string().max(2000)}).strict();
const quoteSchema=z.object({customerId:z.string().max(100),title:z.string().trim().min(2).max(200),dueDate:date,validUntil:date,notes:z.string().max(4000),lines:z.array(lineSchema).min(1).max(50)}).strict();
export function registerSales(app:Express,db:Database){
  app.post('/api/customers',roles('admin','manager','estimator'),async(req,res)=>{
    const v=customerSchema.parse(req.body),cid=id();await db.transaction(async tx=>{await tx.query('INSERT INTO customers(id,company_id,name,contact,email,phone,address,sector,terms,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[cid,req.user.company_id,v.name,v.contact,v.email,v.phone,v.address,v.sector,v.terms,v.notes]);await audit(tx,req.user,'customer',cid,'Created');});res.status(201).json({id:cid});
  });
  app.put('/api/customers/:id',roles('admin','manager','estimator'),async(req,res)=>{
    const v=customerSchema.parse(req.body);await db.transaction(async tx=>{const r=await tx.query('UPDATE customers SET name=$1,contact=$2,email=$3,phone=$4,address=$5,sector=$6,terms=$7,notes=$8 WHERE id=$9 AND company_id=$10 RETURNING id',[v.name,v.contact,v.email,v.phone,v.address,v.sector,v.terms,v.notes,req.params.id,req.user.company_id]);if(!r.rows.length)fail(404,'Customer not found.');await audit(tx,req.user,'customer',String(req.params.id),'Updated');});res.json({ok:true});
  });
  app.get('/api/quotes/:id',roles('admin','manager','estimator'),async(req,res)=>{
    const q=(await db.query('SELECT * FROM quotes WHERE id=$1 AND company_id=$2',[req.params.id,req.user.company_id])).rows[0];if(!q)fail(404,'Quote not found.');const lines=await db.query('SELECT snapshot FROM quote_lines WHERE quote_id=$1 ORDER BY position',[q.id]);res.json({...q,lines:lines.rows.map(l=>l.snapshot)});
  });
  app.post('/api/quotes',roles('admin','manager','estimator'),async(req,res)=>{
    const v=quoteSchema.parse(req.body);let lines;try{lines=v.lines.map(calculateLine);}catch(e){fail(400,e instanceof Error?e.message:'Invalid estimate.');}if(lines!.reduce((s,l)=>s+l.sell,0)>20000000||lines!.reduce((s,l)=>s+l.cost,0)>20000000)fail(400,'Quote value exceeds the supported maximum.');const qid=id();
    await db.transaction(async tx=>{
      const customer=await tx.query('SELECT id FROM customers WHERE id=$1 AND company_id=$2',[v.customerId,req.user.company_id]);if(!customer.rows.length)fail(400,'Select a valid customer.');
      const number=`QT-${(await tx.query("SELECT nextval('quote_number_seq') n")).rows[0].n}`;
      await tx.query('INSERT INTO quotes(id,company_id,number,customer_id,title,status,due_date,valid_until,notes,total_cents,cost_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[qid,req.user.company_id,number,v.customerId,v.title,'Draft',v.dueDate,v.validUntil,v.notes,Math.round(lines!.reduce((a,l)=>a+l.sell,0)*100),Math.round(lines!.reduce((a,l)=>a+l.cost,0)*100)]);
      for(let i=0;i<lines!.length;i++)await tx.query('INSERT INTO quote_lines(id,quote_id,position,snapshot) VALUES($1,$2,$3,$4)',[id(),qid,i,JSON.stringify(lines![i])]);await audit(tx,req.user,'quote',qid,'Created',{number});
    });res.status(201).json({id:qid});
  });
  app.post('/api/quotes/:id/status',roles('admin','manager','estimator'),async(req,res)=>{
    const v=z.object({status:z.enum(['Sent','Accepted','Declined'])}).strict().parse(req.body);
    await db.transaction(async tx=>{const q=(await tx.query('SELECT * FROM quotes WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,req.user.company_id])).rows[0];if(!q)fail(404,'Quote not found.');const allowed:Record<string,string[]>={Draft:['Sent'],Sent:['Accepted','Declined'],Accepted:[],Declined:[]};if(!allowed[q.status].includes(v.status))fail(409,`Cannot change ${q.status} to ${v.status}.`);await tx.query('UPDATE quotes SET status=$1 WHERE id=$2',[v.status,q.id]);await audit(tx,req.user,'quote',q.id,`Marked ${v.status}`);});res.json({ok:true});
  });
  app.put('/api/quotes/:id',roles('admin','manager','estimator'),async(req,res)=>{
    const v=quoteSchema.parse(req.body);let lines;try{lines=v.lines.map(calculateLine);}catch(e){fail(400,e instanceof Error?e.message:'Invalid estimate.');}
    await db.transaction(async tx=>{
      const q=(await tx.query('SELECT * FROM quotes WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,req.user.company_id])).rows[0];if(!q)fail(404,'Quote not found.');if(q.status!=='Draft')fail(409,'Only draft quotes can be edited. Sent and accepted specifications are locked.');
      if(!(await tx.query('SELECT id FROM customers WHERE id=$1 AND company_id=$2',[v.customerId,req.user.company_id])).rows.length)fail(400,'Select a valid customer.');
      const total=Math.round(lines!.reduce((a,l)=>a+l.sell,0)*100),cost=Math.round(lines!.reduce((a,l)=>a+l.cost,0)*100);if(total>2000000000||cost>2000000000)fail(400,'Quote value exceeds the supported maximum.');
      await tx.query('UPDATE quotes SET customer_id=$1,title=$2,due_date=$3,valid_until=$4,notes=$5,total_cents=$6,cost_cents=$7 WHERE id=$8',[v.customerId,v.title,v.dueDate,v.validUntil,v.notes,total,cost,q.id]);await tx.query('DELETE FROM quote_lines WHERE quote_id=$1',[q.id]);
      for(let i=0;i<lines!.length;i++)await tx.query('INSERT INTO quote_lines(id,quote_id,position,snapshot) VALUES($1,$2,$3,$4)',[id(),q.id,i,JSON.stringify(lines![i])]);await audit(tx,req.user,'quote',q.id,'Edited draft',{before:{title:q.title,total_cents:q.total_cents},after:{title:v.title,total_cents:total}});
    });res.json({id:req.params.id});
  });
  app.post('/api/quotes/:id/convert',roles('admin','manager','estimator'),async(req,res)=>{
    const result=await db.transaction(async tx=>{const q=(await tx.query('SELECT * FROM quotes WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,req.user.company_id])).rows[0];if(!q)fail(404,'Quote not found.');if(q.status!=='Accepted')fail(409,'Accept the quote before creating an order.');const existing=(await tx.query('SELECT id,number FROM orders WHERE quote_id=$1',[q.id])).rows[0];if(existing)return existing;
      const oid=id(),number=`SO-${(await tx.query("SELECT nextval('order_number_seq') n")).rows[0].n}`;
      await tx.query('INSERT INTO orders(id,company_id,number,customer_id,quote_id,title,status,due_date,total_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[oid,req.user.company_id,number,q.customer_id,q.id,q.title,'Confirmed',q.due_date,q.total_cents]);const lines=await tx.query('SELECT snapshot FROM quote_lines WHERE quote_id=$1 ORDER BY position',[q.id]);for(const {snapshot:s} of lines.rows)await tx.query('INSERT INTO order_lines(id,order_id,description,quantity,snapshot) VALUES($1,$2,$3,$4,$5)',[id(),oid,s.description,s.quantity,JSON.stringify(s)]);await audit(tx,req.user,'order',oid,'Created from quote',{quote:q.number});return{id:oid,number};});res.status(201).json(result);
  });
  app.get('/api/orders/:id',async(req,res)=>{
    const o=(await db.query('SELECT * FROM orders WHERE id=$1 AND company_id=$2',[req.params.id,req.user.company_id])).rows[0];if(!o)fail(404,'Order not found.');const lines=(await db.query('SELECT * FROM order_lines WHERE order_id=$1',[o.id])).rows;
    if(!financial(req.user)){delete o.total_cents;for(const l of lines)l.snapshot={width:l.snapshot.width,height:l.snapshot.height,product:l.snapshot.product,finishedArea:l.snapshot.finishedArea};}res.json({...o,lines});
  });
  app.patch('/api/orders/:id',roles('admin','manager','estimator'),async(req,res)=>{
    const v=z.object({site:z.string().max(500),po_number:z.string().max(100),deposit_paid:z.boolean()}).strict().parse(req.body);await db.transaction(async tx=>{const r=await tx.query('UPDATE orders SET site=$1,po_number=$2,deposit_paid=$3 WHERE id=$4 AND company_id=$5 RETURNING id',[v.site,v.po_number,v.deposit_paid,req.params.id,req.user.company_id]);if(!r.rows.length)fail(404,'Order not found.');await audit(tx,req.user,'order',String(req.params.id),'Updated',{deposit_paid:v.deposit_paid});});res.json({ok:true});
  });
  app.post('/api/orders/:id/jobs',roles('admin','manager'),async(req,res)=>{
    const result=await db.transaction(async tx=>{
      const o=(await tx.query('SELECT * FROM orders WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,req.user.company_id])).rows[0];if(!o)fail(404,'Order not found.');if(['Completed','Cancelled'].includes(o.status))fail(409,'This order is closed.');const lines=(await tx.query('SELECT * FROM order_lines WHERE order_id=$1',[o.id])).rows;const jobs=[];
      for(const line of lines){const existing=(await tx.query('SELECT id,number FROM jobs WHERE order_line_id=$1',[line.id])).rows[0];if(existing){jobs.push(existing);continue;}const jid=id(),number=`JB-${(await tx.query("SELECT nextval('job_number_seq') n")).rows[0].n}`;await tx.query('INSERT INTO jobs(id,company_id,number,order_id,order_line_id,customer_id,title,department,state,priority,due_date,ordered,area) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[jid,req.user.company_id,number,o.id,line.id,o.customer_id,line.description,'Prepress','Ready','Normal',o.due_date,line.quantity,line.snapshot.finishedArea]);await tx.query('INSERT INTO job_events(id,company_id,job_id,actor,action,detail) VALUES($1,$2,$3,$4,$5,$6)',[id(),req.user.company_id,jid,req.user.name,'Job created',`Created from ${o.number}`]);jobs.push({id:jid,number});}
      await tx.query("UPDATE orders SET status='In production' WHERE id=$1",[o.id]);await audit(tx,req.user,'order',o.id,'Generated production jobs');return jobs;
    });res.status(201).json({jobs:result});
  });
}
