import test from 'node:test';
import assert from 'node:assert/strict';
import {TurnAlerts} from '../turn-alerts.js';
test('turn alert fires once for each local turn, never for another player or bidding',()=>{
 let count=0;const alerts=new TurnAlerts({localId:'me',onAlert:()=>count++});
 alerts.update({key:1,phase:'play',turn:'other'});alerts.update({key:2,phase:'bid',turn:'me'});assert.equal(count,0);
 alerts.update({key:3,phase:'play',turn:'me'});alerts.update({key:3,phase:'play',turn:'me'});alerts.flush();assert.equal(count,1);
 alerts.update({key:4,phase:'play',turn:'other'});alerts.update({key:5,phase:'play',turn:'me'});assert.equal(count,2);
});
test('hidden turn defers until visible, drops stale turns and clears on leaving',()=>{
 let visible=false,count=0;const alerts=new TurnAlerts({localId:'me',onAlert:()=>count++,isVisible:()=>visible});
 alerts.update({key:1,phase:'play',turn:'me'});assert.equal(count,0);visible=true;alerts.flush();assert.equal(count,1);
 visible=false;alerts.update({key:2,phase:'play',turn:'me'});alerts.update({key:3,phase:'play',turn:'other'});visible=true;alerts.flush();assert.equal(count,1);
 visible=false;alerts.update({key:4,phase:'play',turn:'me'});alerts.clear();visible=true;alerts.flush();assert.equal(count,1);
});
