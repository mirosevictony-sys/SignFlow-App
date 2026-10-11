import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateLine,defaultLine} from '../shared/costing.js';
test('40 square stickers distinguish finished area from roll consumed, with waste once',()=>{
  const r=calculateLine({...defaultLine,width:450,height:450,quantity:40,rollWidth:1370,bleed:0,gap:0,waste:10,rotate:false,materialRate:10,inkRate:0,finishingRate:0,labourHours:0,setup:0,minimum:0,margin:50});
  assert.equal(r.finishedArea,8.1);assert.equal(r.across,3);assert.equal(r.rows,14);assert.equal(r.consumedArea,9.49);assert.equal(r.costs.material,94.94);assert.equal(r.sell,189.88);
});
test('bleed and gaps affect yield and rotation obeys the restriction',()=>{
  const r=calculateLine({...defaultLine,width:450,height:450,quantity:40,rollWidth:1370,bleed:3,gap:5});assert.equal(r.across,2);
  assert.throws(()=>calculateLine({...defaultLine,width:1800,height:500,rotate:false}),/does not fit/);
  assert.equal(calculateLine({...defaultLine,width:1800,height:500,rotate:true}).rotated,true);
});
test('minimum charge, margin and invalid unit inputs are handled explicitly',()=>{
  const r=calculateLine({...defaultLine,width:100,height:100,quantity:1,materialRate:0,inkRate:0,finishingRate:0,labourHours:0,setup:10,minimum:45,margin:70});assert.equal(r.sell,45);assert.equal(r.cost,10);
  assert.throws(()=>calculateLine({...defaultLine,margin:100}));assert.throws(()=>calculateLine({...defaultLine,quantity:1.5}));assert.throws(()=>calculateLine({...defaultLine,width:-1}));
});
