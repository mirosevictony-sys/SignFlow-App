import {useEffect} from 'react';
import type {Bootstrap} from '../../shared/types';
import type {Selection} from './App';
/** Optional WebMCP support; these tools share the same records and drawers as the UI. */
export function useAgentTools(data:Bootstrap|null,open:(s:Selection)=>void){
  useEffect(()=>{
    const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>Promise<void>|void}}).modelContext;
    if(!context?.registerTool||!data)return;const lifecycle=new AbortController();
    const register=(tool:unknown)=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Unsupported browsers keep normal UI access. */}};
    register({name:'list_production_jobs',title:'List production jobs',description:'Read the production jobs visible to the signed-in user. No financial fields are returned.',inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(raw:unknown)=>{const input=raw as {query?:unknown};if(!input||typeof input!=='object'||(input.query!==undefined&&typeof input.query!=='string')||Object.keys(input).some(k=>k!=='query'))throw new Error('Expected an optional text query.');const q=String(input.query||'').toLowerCase();return data.jobs.filter(j=>(j.number+' '+j.title+' '+j.customer_name).toLowerCase().includes(q)).map(j=>({id:j.id,number:j.number,title:j.title,department:j.department,state:j.state,ordered:j.ordered,produced:j.produced,dueDate:j.due_date}));}});
    register({name:'open_production_job',title:'Open a job card',description:'Open an existing job card in the interface. Does not change production records.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(raw:unknown)=>{const input=raw as {id?:unknown};if(!input||typeof input!=='object'||typeof input.id!=='string'||Object.keys(input).some(k=>k!=='id'))throw new Error('A job ID is required.');if(!data.jobs.some(j=>j.id===input.id))throw new Error('Job not found.');open({type:'job',id:input.id});await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return{opened:true,id:input.id};}});
    return()=>lifecycle.abort();
  },[data]);
}
