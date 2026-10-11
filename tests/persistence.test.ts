import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {connectDb,migrate} from '../server/db.js';
import {seed} from '../server/seed.js';
test('a persisted database survives close, reopen, migrations and seeding',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'signflow-persistence-'));
  process.env.DATABASE_MODE='embedded';process.env.EMBEDDED_PATH=path.join(dir,'postgres');
  let db=await connectDb();
  try{await migrate(db);await seed(db);await db.query("UPDATE customers SET notes='Persistence verified' WHERE id='customer-1'");await db.close();db=await connectDb();await migrate(db);await seed(db);assert.equal((await db.query("SELECT notes FROM customers WHERE id='customer-1'")).rows[0].notes,'Persistence verified');assert.equal(Number((await db.query('SELECT count(*) n FROM customers')).rows[0].n),12);}finally{await db.close();await rm(dir,{recursive:true,force:true});}
});
