import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Database } from './db.js';
export const id=()=>randomUUID();
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function verifyPassword(password:string,hash:string){const [salt,key]=hash.split(':');const actual=scryptSync(password,salt,64);const expected=Buffer.from(key,'hex');return actual.length===expected.length && timingSafeEqual(actual,expected);}
export const hashToken=(s:string)=>createHash('sha256').update(s).digest('hex');
export type User={id:string;company_id:string;name:string;email:string;role:'admin'|'manager'|'estimator'|'operator'};
declare global {namespace Express {interface Request {user:User}}}
export const financial=(u:User)=>u.role!=='operator';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export const fail=(status:number,message:string):never=>{throw new HttpError(status,message);};
export function roles(...allowed:User['role'][]){return(req:Request,_res:Response,next:NextFunction)=>{if(!allowed.includes(req.user.role))return next(new HttpError(403,'Your role cannot perform this action.'));next();};}
export async function audit(db:Database,user:User,entity:string,entityId:string,action:string,detail:unknown={}){await db.query('INSERT INTO audit_log(id,company_id,actor,entity_type,entity_id,action,detail) VALUES($1,$2,$3,$4,$5,$6,$7)',[id(),user.company_id,user.name,entity,entityId,action,JSON.stringify(detail)]);}
export function auth(db:Database){return async(req:Request,_res:Response,next:NextFunction)=>{try{const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('signflow_session='))?.slice(17);if(!token)return next(new HttpError(401,'Sign in to continue.'));const r=await db.query('SELECT u.id,u.company_id,u.name,u.email,u.role FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hashToken(token)]);if(!r.rows[0])return next(new HttpError(401,'Session expired. Sign in again.'));req.user=r.rows[0];next();}catch(e){next(e);}};}
export function sessionCookie(res:Response,token:string,maxAge=28800000){res.cookie('signflow_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge,path:'/'});}
export function csrf(req:Request,_res:Response,next:NextFunction){if(!['GET','HEAD','OPTIONS'].includes(req.method)){
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host)return next(new HttpError(403,'Cross-site requests are blocked.'));}catch{return next(new HttpError(403,'Invalid request origin.'));}}
  if(req.headers['sec-fetch-site']==='cross-site')return next(new HttpError(403,'Cross-site requests are blocked.'));
  if(!req.is('application/json'))return next(new HttpError(415,'Use application/json.'));
}next();}
