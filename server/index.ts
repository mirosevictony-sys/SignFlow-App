import {connectDb,migrate} from './db.js';
import {seed} from './seed.js';
import {createApp} from './app.js';
const db=await connectDb();
await migrate(db);await seed(db);
const app=createApp(db);
const server=app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`SignFlow listening on port ${process.env.PORT||3000}`));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>{void db.close().then(()=>process.exit(0));});});
