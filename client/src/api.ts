export async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch(`/api${path}`,{method,headers:body!==undefined?{'Content-Type':'application/json'}:undefined,body:body===undefined?undefined:JSON.stringify(body)});
  const value=await response.json().catch(()=>({error:'Server returned an invalid response.'}));
  if(!response.ok){const e=new Error(value.error||'Request failed.') as Error&{status:number};e.status=response.status;throw e;}return value;
}
export const money=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(cents/100);
export const compactMoney=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',notation:'compact',maximumFractionDigits:1}).format(cents/100);
export const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateText=(s:string)=>new Date(s.slice(0,10)+'T12:00:00').toLocaleDateString('en-IE',{day:'numeric',month:'short'});
export const isoAfter=(days:number)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);};
export const initials=(s:string)=>s.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
export function exportCsv(filename:string,headers:string[],rows:unknown[][]){
  const esc=(v:unknown)=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const blob=new Blob(['\ufeff'+[headers,...rows].map(row=>row.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
