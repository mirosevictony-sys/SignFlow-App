import { z } from 'zod';
export const lineSchema = z.object({
  description: z.string().trim().min(2).max(200),
  product: z.enum(['Printed vinyl','Clear film + white','Frosted film','Plotted vinyl','Rigid panel','Poster','Banner']),
  width: z.number().positive().max(20000), height: z.number().positive().max(20000),
  quantity: z.number().int().min(1).max(10000), rollWidth: z.number().min(300).max(3200),
  bleed: z.number().min(0).max(50), gap: z.number().min(0).max(100),
  waste: z.number().min(0).max(50), materialRate: z.number().min(0).max(10000),
  inkRate: z.number().min(0).max(500), finishingRate: z.number().min(0).max(500),
  labourHours: z.number().min(0).max(1000), labourRate: z.number().min(0).max(500),
  setup: z.number().min(0).max(10000), margin: z.number().min(0).max(95),
  minimum: z.number().min(0).max(100000), rotate: z.boolean()
}).strict();
export type LineInput = z.infer<typeof lineSchema>;
export const round = (v:number) => Math.round((v + Number.EPSILON)*100)/100;
export function calculateLine(raw: LineInput) {
  const v=lineSchema.parse(raw);
  const fits=(w:number,h:number)=>{
    const across=Math.floor((v.rollWidth+v.gap)/(w+2*v.bleed+v.gap));
    const rows=across ? Math.ceil(v.quantity/across) : 0;
    return {across,rows,length: rows ? (rows*(h+2*v.bleed)+(rows-1)*v.gap)/1000 : Infinity};
  };
  const normal=fits(v.width,v.height), rotated=fits(v.height,v.width);
  const rotation=v.rotate && rotated.length<normal.length;
  const layout=rotation?rotated:normal;
  if(!layout.across) throw new Error('Artwork does not fit the usable roll width. Increase width, allow rotation, or split into panels.');
  const finishedArea=v.width*v.height*v.quantity/1e6;
  const baseArea=layout.length*v.rollWidth/1000;
  const consumedArea=baseArea*(1+v.waste/100);
  const costs={material:round(consumedArea*v.materialRate),ink:round(finishedArea*v.inkRate),finishing:round(finishedArea*v.finishingRate),labour:round(v.labourHours*v.labourRate),setup:round(v.setup)};
  const cost=round(Object.values(costs).reduce((a,b)=>a+b,0));
  const sell=round(Math.max(v.minimum,cost/(1-v.margin/100)));
  return {version:'rectangular-roll-v1',...v,finishedArea:round(finishedArea),consumedArea:round(consumedArea),linearMetres:round(layout.length*(1+v.waste/100)),across:layout.across,rows:layout.rows,rotated:rotation,costs,cost,sell,unitPrice:round(sell/v.quantity),actualMargin:sell?round((sell-cost)/sell*100):0};
}
export type CostedLine = ReturnType<typeof calculateLine>;
export const defaultLine: LineInput={description:'Printed and laminated graphics',product:'Printed vinyl',width:1000,height:700,quantity:10,rollWidth:1300,bleed:3,gap:5,waste:12,materialRate:3.5,inkRate:1.25,finishingRate:3,labourHours:1,labourRate:40,setup:15,margin:70,minimum:45,rotate:true};
