import pg from 'pg';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
export interface Database { query(sql:string,params?:unknown[]):Promise<{rows:any[];rowCount?:number|null}>; transaction<T>(fn:(db:Database)=>Promise<T>):Promise<T>; close():Promise<void> }
export async function connectDb():Promise<Database>{
  if(process.env.DATABASE_MODE==='embedded'){
    if(process.env.NODE_ENV==='production') throw new Error('Embedded mode is development-only. Production requires PostgreSQL.');
    const {PGlite}=await import('@electric-sql/pglite');
    const location=process.env.EMBEDDED_PATH || '.data/postgres';
    if(location!=='memory://')await mkdir(path.dirname(location),{recursive:true});
    const pgLite=new PGlite(location);
    const wrap=(db:any):Database=>({query:async(sql,p)=>{const r=await db.query(sql,p);return {rows:r.rows,rowCount:r.affectedRows};},transaction:fn=>db.transaction((tx:any)=>fn(wrap(tx))),close:()=>pgLite.close()});
    return wrap(pgLite);
  }
  const pool=new pg.Pool({max:10,connectionString:process.env.DATABASE_URL});
  return {query:(s,p)=>pool.query(s,p),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const d:Database={query:(s,p)=>c.query(s,p),transaction:f=>f(d),close:async()=>{}};const result=await fn(d);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},close:()=>pool.end()};
}
export async function migrate(db:Database){
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir('server/migrations')).filter(n=>n.endsWith('.sql')).sort()){
    await db.transaction(async tx=>{
      await tx.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
      if((await tx.query('SELECT name FROM schema_migrations WHERE name=$1',[name])).rows.length) return;
      const sql=await readFile(`server/migrations/${name}`,'utf8');
      for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await tx.query(statement);
      await tx.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
    });
  }
}
