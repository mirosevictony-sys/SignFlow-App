import type { Database } from './db.js';
import { hashPassword } from './security.js';
import { calculateLine, defaultLine } from '../shared/costing.js';
const date=(offset:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
export async function seed(db:Database){await db.transaction(async tx=>{
  await tx.query('LOCK TABLE companies IN EXCLUSIVE MODE');
  if((await tx.query('SELECT id FROM companies LIMIT 1')).rows.length)return;
  await tx.query('INSERT INTO companies(id,name,settings) VALUES($1,$2,$3)',['connect-install','Connect Install',JSON.stringify({currency:'EUR',labourRate:40,defaultMargin:70,defaultWaste:12,rollWidth:1300,inkRate:1.25,minimumCharge:45,requireArtwork:true,requireMaterial:true,requireDeposit:false,timezone:'Europe/Dublin'})]);
  for(const user of [{id:'tony',name:'Tony Mirosevic',email:process.env.ADMIN_EMAIL||'tony@signflow.local',role:'admin',password:process.env.ADMIN_PASSWORD||'SignFlow-Demo-2026!'},{id:'operator',name:'Production Operator',email:'operator@signflow.local',role:'operator',password:process.env.OPERATOR_PASSWORD||'Operator-Demo-2026!'}]){
    if(user.password.length<12)throw new Error('Initial passwords must contain at least 12 characters.');
    await tx.query('INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)',[user.id,'connect-install',user.name,user.email.toLowerCase(),hashPassword(user.password),user.role]);
  }
  const machines=[['epson','Epson SC-9100','Printer','Production','Available',35,'Eco-solvent · CMYK + white · ONYX workflow'],['summa','Summa S1 D160','Cutter','Finishing','Available',18,'OPOS contour cutting · vinyl cutting · FlexCut'],['laminator','Cold laminator','Laminator','Finishing','Available',12,'Cold lamination · film application'],['bench-1','Finishing station 01','Workstation','Finishing','Available',0,'Mounting · weeding · application tape'],['bench-2','Finishing station 02','Workstation','Finishing','Available',0,'Panel assembly · quality control · packing']];
  for(const m of machines)await tx.query('INSERT INTO machines(id,company_id,name,kind,department,state,hourly_rate,capabilities) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[m[0],'connect-install',...m.slice(1)]);
  if(process.env.SEED_DEMO==='false')return;
  const customers=[['Harbour & Co.','Sarah Kelly','Retail','Dublin Docklands'],['Northline Retail','James Murphy','Retail','Swords, Co. Dublin'],['Oakfield Workspace','Emma Byrne','Corporate','Sandyford, Dublin'],['The Rowan Hotel','Daniel Walsh','Hospitality','Dublin 2'],['Vertex Construction','Laura Ryan','Construction','Tallaght, Dublin'],['Coastline Fitness','Mark Nolan','Leisure','Bray, Co. Wicklow'],['Aster Property','Aoife Clarke','Property','Grand Canal, Dublin'],['Bloom Coffee','Ben Doyle','Hospitality','Dublin 8'],['Westhaven Events','Chloe Quinn','Events','Galway'],['Lumen Health','Tom O’Brien','Healthcare','Cork'],['Fable Studio','Mia Collins','Creative','Dublin 7'],['Greenway Logistics','Alex Moore','Transport','Ballymount, Dublin']];
  for(let i=0;i<customers.length;i++){const c=customers[i];await tx.query('INSERT INTO customers(id,company_id,name,contact,email,phone,address,sector,terms,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[`customer-${i+1}`,'connect-install',c[0],c[1],`contact${i+1}@example.com`,'',c[3],c[2],30,'Fictional customer for the SignFlow demo.']);}
  const projects=[['Docklands window refresh','Clear film + white',8,950,1800],['Autumn retail campaign','Printed vinyl',40,450,450],['Office privacy film','Frosted film',12,1000,1500],['Lobby wayfinding','Rigid panel',6,594,841],['Site hoarding graphics','Printed vinyl',20,1000,2000],['Studio wall graphics','Printed vinyl',4,1200,2400],['Reception brand refresh','Plotted vinyl',3,900,600],['New café opening','Printed vinyl',10,700,1000],['Exhibition graphics','Banner',8,1000,2000],['Clinic room identification','Rigid panel',24,250,150],['Creative studio signage','Plotted vinyl',5,800,600],['Fleet door graphics','Printed vinyl',16,600,450],['Seasonal window promotion','Poster',30,594,841],['Feature wall lettering','Plotted vinyl',6,1000,500]] as const;
  const stages=['Production','Prepress','Finishing','Installation','Prepress','Production','Finishing','Ready to Invoice','Design','Production','Finishing','Completed','Prepress','Production','Installation','Finishing'];
  for(let i=0;i<projects.length;i++){
    const p=projects[i],status=i<8?'Accepted':i<11?'Sent':i===13?'Declined':'Draft';
    const qid=`quote-${i+1}`,customerId=`customer-${i%12+1}`;
    const lines=[calculateLine({...defaultLine,description:p[0],product:p[1],quantity:p[2],width:p[3],height:p[4],inkRate:p[1]==='Clear film + white'?3.2:1.25,materialRate:p[1]==='Rigid panel'?18:3.5}),calculateLine({...defaultLine,description:i%2?'Entrance opening hours':'Supporting directional graphics',product:'Printed vinyl',width:350,height:250,quantity:4,labourHours:0.5,minimum:45})];
    const total=Math.round(lines.reduce((a,l)=>a+l.sell,0)*100),cost=Math.round(lines.reduce((a,l)=>a+l.cost,0)*100);
    await tx.query('INSERT INTO quotes(id,company_id,number,customer_id,title,status,due_date,valid_until,total_cents,cost_cents,notes,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[qid,'connect-install',`QT-${1040+i}`,customerId,p[0],status,date(i%7-1),date(14),total,cost,'Demo estimate. Prices exclude VAT. Confirm specifications before production.',date(-14+i)+'T09:00:00Z']);
    for(let l=0;l<lines.length;l++)await tx.query('INSERT INTO quote_lines(id,quote_id,position,snapshot) VALUES($1,$2,$3,$4)',[`${qid}-line-${l}`,qid,l,JSON.stringify(lines[l])]);
    if(i>=8)continue;
    const oid=`order-${i+1}`;
    await tx.query('INSERT INTO orders(id,company_id,number,customer_id,quote_id,title,status,due_date,site,po_number,total_cents,deposit_paid) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[oid,'connect-install',`SO-${2032+i}`,customerId,qid,p[0],'In production',date(i%7-1),customers[i][3],`PO-DEMO-${100+i}`,total,i!==4]);
    for(let l=0;l<lines.length;l++){
      const n=i*2+l,line=lines[l],lid=`${oid}-line-${l}`,jid=`job-${n+1}`;
      await tx.query('INSERT INTO order_lines(id,order_id,description,quantity,snapshot) VALUES($1,$2,$3,$4,$5)',[lid,oid,line.description,line.quantity,JSON.stringify(line)]);
      const dep=stages[n];const state=n===4?'Blocked':n===0?'Running':n===9?'Paused':dep==='Completed'?'Complete':'Ready';
      const approved=!['Design','Prepress'].includes(dep),produced=['Finishing','Installation','Ready to Invoice','Completed'].includes(dep)?line.quantity:n===0?3:0;
      const mid=dep==='Production'?'epson':dep==='Finishing'?(n%2?'summa':'laminator'):null;
      await tx.query('INSERT INTO jobs(id,company_id,number,order_id,order_line_id,customer_id,title,department,state,priority,due_date,machine_id,assignee,ordered,produced,rejected,delivered,invoiced,area,artwork_approved,material_ready,approved_version,notes,blocker,elapsed_seconds,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)',[jid,'connect-install',`JB-${3024+n}`,oid,lid,customerId,line.description,dep,state,n===0?'Urgent':n%4===0?'High':'Normal',date(i%7-1),mid,n%3===0?'Tony':'Production team',line.quantity,produced,n===5?1:0,['Ready to Invoice','Completed'].includes(dep)?produced:0,0,line.finishedArea,approved,n!==4,approved?1:null,'Confirm dimensions and orientation on the job card.',n===4?'Awaiting artwork approval and frosted film delivery':'',n*330,state==='Running'?new Date(Date.now()-1200000).toISOString():null]);
      await tx.query('INSERT INTO job_events(id,company_id,job_id,actor,action,detail,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[`seed-event-${n}`,'connect-install',jid,'Tony Mirosevic',state==='Running'?'Started operation':'Job created',state==='Running'?`${dep} started on ${mid==='epson'?'Epson SC-9100':'workstation'}`:`Created from SO-${2032+i}`,new Date(Date.now()-n*1800000).toISOString()]);
    }
  }
  // Seeded quote numbers include 1053. Keep the generated sequence beyond them.
  await tx.query("SELECT setval('quote_number_seq', 1053)");
});}
