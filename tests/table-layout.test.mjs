import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tableLayout} from '../public/table-layout.js';
test('2–10 seats spread evenly with the local player at bottom',()=>{
  for(let count=2;count<=10;count++) {
    const players=Array.from({length:count},(_,i)=>({id:String(i)}));
    const layout=tableLayout(players,'1');
    assert.equal(layout.seats.length,count);
    assert.equal(layout.columns,Math.ceil(count/2));
    const local=layout.seats.find(s=>s.id==='1');assert.equal(local.x,50);assert.equal(local.y,92);
    assert.equal(new Set(layout.seats.map(s=>`${s.x},${s.y}`)).size,count);
    assert.ok(layout.seats.every(s=>s.x>=7&&s.x<=93&&s.y>=8&&s.y<=92));
  }
});
