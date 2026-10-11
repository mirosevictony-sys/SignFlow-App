import type {Express} from 'express';
import {z} from 'zod';
import type {Database} from '../db.js';
import {audit,fail,financial,id,roles} from '../security.js';
import {departments,priorities} from '../../shared/constants.js';
const actionSchema=z.object({action:z.enum(['start','pause','block','unblock','advance','output','approve','revise','materials','deliver']),version:z.number().int().positive(),good:z.number().int().min(0).max(100000).default(0),rejected:z.number().int().min(0).max(100000).default(0),note:z.string().max(2000).default('')}).strict();
export function registerProduction(app:Express,db:Database){
  app.get('/api/jobs/:id',async(req,res)=>{
    const j=(await db.query('SELECT j.*,l.snapshot FROM jobs j JOIN order_lines l ON l.id=j.order_line_id WHERE j.id=$1 AND j.company_id=$2',[req.params.id,req.user.company_id])).rows[0];if(!j)fail(404,'Job not found.');
    if(!financial(req.user)){const s=j.snapshot;j.snapshot={description:s.description,product:s.product,width:s.width,height:s.height,quantity:s.quantity,finishedArea:s.finishedArea,rollWidth:s.rollWidth,bleed:s.bleed,gap:s.gap,rotate:s.rotate};}
    const events=(await db.query('SELECT * FROM job_events WHERE job_id=$1 AND company_id=$2 ORDER BY created_at DESC',[j.id,req.user.company_id])).rows;res.json({...j,events});
  });
  app.patch('/api/jobs/:id',roles('admin','manager'),async(req,res)=>{
    const v=z.object({version:z.number().int().positive(),priority:z.enum(priorities),due_date:z.iso.date(),machine_id:z.string().nullable(),assignee:z.string().max(100),notes:z.string().max(4000)}).strict().parse(req.body);
    await db.transaction(async tx=>{
      const j=(await tx.query('SELECT * FROM jobs WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,req.user.company_id])).rows[0];if(!j)fail(404,'Job not found.');if(j.version!==v.version)fail(409,'This job changed. Close and reopen it before saving.');if(j.state==='Running'&&j.machine_id!==v.machine_id)fail(409,'Pause the operation before reassigning its machine.');
      if(v.machine_id&&!(await tx.query('SELECT id FROM machines WHERE id=$1 AND company_id=$2',[v.machine_id,req.user.company_id])).rows.length)fail(400,'Machine not found.');
      await tx.query('UPDATE jobs SET priority=$1,due_date=$2,machine_id=$3,assignee=$4,notes=$5,version=version+1 WHERE id=$6',[v.priority,v.due_date,v.machine_id,v.assignee,v.notes,j.id]);await audit(tx,req.user,'job',j.id,'Updated job details',v);
    });res.json({ok:true});
  });
  app.post('/api/jobs/:id/action',async(req,res)=>{
    const v=actionSchema.parse(req.body);if(['approve','revise','materials'].includes(v.action)&&!['admin','manager'].includes(req.user.role))fail(403,'A manager must change release approvals.');if(req.user.role==='estimator')fail(403,'Production access is required.');
    await db.transaction(async tx=>{
      const j=(await tx.query('SELECT * FROM jobs WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,req.user.company_id])).rows[0];if(!j)fail(404,'Job not found.');if(j.version!==v.version)fail(409,'This job changed. Close and reopen it before trying again.');if(['Complete','Cancelled'].includes(j.state))fail(409,'This job is closed.');
      // Serialize order roll-ups across jobs so concurrent stage completions cannot
      // overwrite a newer order status with an older calculation.
      await tx.query('SELECT id FROM orders WHERE id=$1 AND company_id=$2 FOR UPDATE',[j.order_id,req.user.company_id]);
      const settings=(await tx.query('SELECT settings FROM companies WHERE id=$1',[req.user.company_id])).rows[0].settings;
      const checkGates=async()=>{if(settings.requireArtwork&&(!j.artwork_approved||j.approved_version!==j.artwork_version))fail(409,'Current artwork version needs manager approval.');if(settings.requireMaterial&&!j.material_ready)fail(409,'Materials are not ready.');if(settings.requireDeposit){const o=(await tx.query('SELECT deposit_paid FROM orders WHERE id=$1',[j.order_id])).rows[0];if(!o.deposit_paid)fail(409,'Deposit must be confirmed before release.');}};
      const stopTimer=()=>{if(j.started_at){j.elapsed_seconds+=Math.max(0,Math.floor((Date.now()-new Date(j.started_at).getTime())/1000));j.started_at=null;}};
      let detail=v.note,action=v.action as string;
      switch(v.action){
        case 'start':
          if(!['Ready','Queued','Paused'].includes(j.state))fail(409,'Only ready, queued or paused work can start.');
          if(!['Design','Prepress'].includes(j.department))await checkGates();
          if(j.machine_id){const m=(await tx.query('SELECT * FROM machines WHERE id=$1 AND company_id=$2 FOR UPDATE',[j.machine_id,req.user.company_id])).rows[0];if(['Maintenance','Offline'].includes(m.state))fail(409,'This machine is unavailable.');const running=await tx.query("SELECT number FROM jobs WHERE machine_id=$1 AND state='Running' AND id<>$2",[j.machine_id,j.id]);if(running.rows.length)fail(409,`${running.rows[0].number} is already running on this machine.`);}
          j.state='Running';j.started_at=new Date().toISOString();action='Started operation';detail=j.department;break;
        case 'pause':if(j.state!=='Running')fail(409,'Only running work can be paused.');stopTimer();j.state='Paused';action='Paused operation';detail=v.note||'Operator pause';break;
        case 'block':if(!v.note.trim())fail(400,'Enter a reason for the hold.');stopTimer();j.state='Blocked';j.blocker=v.note;action='Placed on hold';break;
        case 'unblock':if(j.state!=='Blocked')fail(409,'This job is not on hold.');j.state='Ready';j.blocker='';action='Released hold';break;
        case 'output':
          if(j.department!=='Production'||!['Running','Paused'].includes(j.state))fail(409,'Record output on a running or paused Production operation.');
          if(!v.good&&!v.rejected)fail(400,'Enter produced or rejected quantity.');if(j.produced+v.good>j.ordered)fail(400,'Good output cannot exceed the ordered quantity.');if(v.rejected&&!v.note.trim())fail(400,'Record a reason for rejected output.');j.produced+=v.good;j.rejected+=v.rejected;action='Recorded output';detail=`${v.good} good · ${v.rejected} rejected${v.note?' · '+v.note:''}`;break;
        case 'advance':{
          if(j.state==='Blocked')fail(409,'Release the hold before advancing.');const index=departments.indexOf(j.department);const next=departments[index+1];if(!next)fail(409,'No remaining department.');if(index>=2&&j.produced<j.ordered)fail(409,'Record all good output before finishing this stage.');
          if(index===1)await checkGates();
          if(j.department==='Installation'&&j.delivered<j.ordered)fail(409,'Record all delivered/installed units before advancing.');
          stopTimer();action='Completed stage';detail=`${j.department} → ${next}`;j.department=next;j.state=next==='Completed'?'Complete':'Ready';j.machine_id=next==='Production'?'epson':next==='Finishing'?'bench-1':null;break;
        }
        case 'approve':if(j.state==='Running')fail(409,'Pause work before approving artwork.');j.artwork_approved=true;j.approved_version=j.artwork_version;action='Artwork approved';detail=`Version ${j.artwork_version} approved by ${req.user.name}`;break;
        case 'revise':stopTimer();j.artwork_version++;j.artwork_approved=false;j.approved_version=null;if(!['Design','Prepress'].includes(j.department)){j.state='Blocked';j.blocker='New artwork version requires review.';}action='Artwork revised';detail=`Version ${j.artwork_version}; previous approval invalidated`;break;
        case 'materials':if(j.state==='Running')fail(409,'Pause work before changing material readiness.');j.material_ready=!j.material_ready;action='Materials updated';detail=j.material_ready?'Materials ready':'Materials unavailable';break;
        case 'deliver':if(!['Installation','Ready to Invoice'].includes(j.department))fail(409,'Delivery is recorded at Installation or Ready to Invoice.');if(!v.good||j.delivered+v.good>j.produced)fail(400,'Delivered quantity must be positive and cannot exceed good output.');j.delivered+=v.good;action='Recorded fulfilment';detail=`${v.good} units delivered / installed`;break;
      }
      await tx.query('UPDATE jobs SET state=$1,department=$2,produced=$3,rejected=$4,delivered=$5,artwork_approved=$6,artwork_version=$7,approved_version=$8,material_ready=$9,blocker=$10,elapsed_seconds=$11,started_at=$12,machine_id=$13,version=version+1 WHERE id=$14',[j.state,j.department,j.produced,j.rejected,j.delivered,j.artwork_approved,j.artwork_version,j.approved_version,j.material_ready,j.blocker,j.elapsed_seconds,j.started_at,j.machine_id,j.id]);
      await tx.query('INSERT INTO job_events(id,company_id,job_id,actor,action,detail) VALUES($1,$2,$3,$4,$5,$6)',[id(),req.user.company_id,j.id,req.user.name,action,detail]);await audit(tx,req.user,'job',j.id,action,{detail});
      const all=(await tx.query('SELECT department,state FROM jobs WHERE order_id=$1',[j.order_id])).rows;const status=all.every(x=>x.state==='Complete')?'Completed':all.every(x=>['Ready to Invoice','Completed'].includes(x.department))?'Ready':'In production';await tx.query('UPDATE orders SET status=$1 WHERE id=$2',[status,j.order_id]);
    });res.json({ok:true});
  });
  app.patch('/api/machines/:id',roles('admin','manager'),async(req,res)=>{
    const v=z.object({state:z.enum(['Available','Running','Maintenance','Offline']),hourly_rate:z.number().min(0).max(10000),notes:z.string().max(2000)}).strict().parse(req.body);
    await db.transaction(async tx=>{const m=(await tx.query('SELECT id FROM machines WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,req.user.company_id])).rows[0];if(!m)fail(404,'Machine not found.');if(['Maintenance','Offline'].includes(v.state)&&(await tx.query("SELECT id FROM jobs WHERE machine_id=$1 AND state='Running'",[m.id])).rows.length)fail(409,'Pause the running operation before taking this machine offline.');await tx.query('UPDATE machines SET state=$1,hourly_rate=$2,notes=$3 WHERE id=$4',[v.state,v.hourly_rate,v.notes,m.id]);await audit(tx,req.user,'machine',m.id,'Updated',v);});res.json({ok:true});
  });
  app.put('/api/settings',roles('admin'),async(req,res)=>{
    const v=z.object({name:z.string().trim().min(2).max(160),settings:z.object({currency:z.literal('EUR'),timezone:z.literal('Europe/Dublin'),labourRate:z.number().min(0).max(500),defaultMargin:z.number().min(0).max(95),defaultWaste:z.number().min(0).max(50),rollWidth:z.number().min(300).max(3200),inkRate:z.number().min(0).max(500),minimumCharge:z.number().min(0).max(100000),requireArtwork:z.boolean(),requireMaterial:z.boolean(),requireDeposit:z.boolean()}).strict()}).strict().parse(req.body);
    await db.transaction(async tx=>{await audit(tx,req.user,'company',req.user.company_id,'Settings changed',v);await tx.query('UPDATE companies SET name=$1,settings=$2 WHERE id=$3',[v.name,JSON.stringify(v.settings),req.user.company_id]);});res.json({ok:true});
  });
}
