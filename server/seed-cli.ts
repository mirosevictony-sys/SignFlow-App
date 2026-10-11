import {connectDb,migrate} from './db.js';
import {seed} from './seed.js';
const db=await connectDb();try{await migrate(db);await seed(db);console.log('Database initialized. Existing records were preserved.');}finally{await db.close();}
