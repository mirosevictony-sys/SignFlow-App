import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {connectDb,migrate} from './server/db';
import {seed} from './server/seed';
import {createApp} from './server/app';
export default defineConfig({
  root: 'client', plugins: [react(),{
    name:'signflow-development-api',
    async configureServer(server){
      // The optional embedded PostgreSQL engine is for local development only.
      // Docker production uses the dedicated PostgreSQL service.
      if(!process.env.DATABASE_URL&&!process.env.PGHOST)process.env.DATABASE_MODE='embedded';
      const db=await connectDb();await migrate(db);await seed(db);const app=createApp(db);
      server.middlewares.use((req,res,next)=>req.url?.startsWith('/api/')?app(req as any,res as any,next):next());
      server.httpServer?.once('close',()=>{void db.close();});
    }
  }],
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts: ['terminal.local'] }
});
