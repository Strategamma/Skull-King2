import test from 'node:test';
import assert from 'node:assert/strict';
import {FeedbackTracker,outcomeText} from '../feedback.js';
const state=()=>({code:'OCEAN',hostId:'a',players:[{id:'a',connected:true,bot:false},{id:'b',connected:true,bot:false}],match:{matchId:'match-1',round:1,trick:1,phase:'play',plays:[],feedback:[]}});
test('first, quiet and resumed snapshots baseline without replaying effects',()=>{
 const t=new FeedbackTracker(),r=state();assert.deepEqual(t.update(r),[]);r.match.plays.push({card:{id:'one'}});
 assert.equal(t.update(r)[0].kind,'play');assert.deepEqual(t.update(r),[]);
 t.reset();assert.deepEqual(t.update(r),[]);r.match.feedback=[{id:'event-1',kind:'kraken',text:'Destroyed'}];
 assert.deepEqual(t.update(r,{quiet:true}),[]);assert.deepEqual(t.update(r),[]);
});
test('outcomes deduplicate by identity and new trick plays do not collide',()=>{
 const t=new FeedbackTracker(),r=state();t.update(r);r.match.feedback=[{id:'one',kind:'power',text:'Declined'}];
 assert.equal(t.update(r).filter(e=>e.kind==='outcome').length,1);r.match.revision=4;assert.deepEqual(t.update(r),[]);
 r.match.trick=2;r.match.plays=[{card:{id:'two'}}];assert.equal(t.update(r)[0].cardId,'two');
});
test('new rounds and rematches deal once, same-card IDs cannot suppress rematches',()=>{
 const t=new FeedbackTracker(),r=state();t.update(r);r.match.round++;assert.equal(t.update(r)[0].kind,'deal');
 r.match.matchId='match-2';r.match.round=1;r.match.phase='bidding';assert.equal(t.update(r)[0].kind,'deal');assert.deepEqual(t.update(r),[]);
});
test('host, temporary/permanent takeover and return are distinct lifecycle transitions',()=>{
 const t=new FeedbackTracker(),r=state();t.update(r);r.hostId='b';r.players[0].connected=false;
 assert.deepEqual(t.update(r).map(e=>e.kind),['host','disconnected']);r.players[0].bot=true;
 assert.match(outcomeText(t.update(r)[0],id=>id),/reclaim/);r.players[0].bot=false;r.players[0].connected=true;
 assert.equal(t.update(r)[0].kind,'returned');r.players[0].bot=true;r.players[0].permanentBot=true;
 assert.match(outcomeText(t.update(r)[0],id=>id),/permanently/);
});
test('reveal, leader, round and final cues follow transitions rather than renders',()=>{
 const t=new FeedbackTracker(),r=state();r.match.phase='bidding';t.update(r);r.match.phase='play';r.match.leadingPlayerId='b';
 assert.deepEqual(t.update(r).map(e=>e.kind),['reveal','leader']);r.match.phase='round';assert.equal(t.update(r)[0].kind,'round');
 r.match.phase='finished';assert.equal(t.update(r)[0].kind,'finished');assert.deepEqual(t.update(r),[]);
});

test('permanent replacement of a temporary bot and removed lobby seats are announced',()=>{
 const t=new FeedbackTracker(),r=state();r.players[1].bot=true;t.update(r);r.players[1].permanentBot=true;
 assert.equal(t.update(r)[0].permanent,true);r.players.pop();assert.equal(t.update(r)[0].kind,'removed');
});

test('private hand additions cue only newly drawn local cards, never repeated snapshots',()=>{
 const t=new FeedbackTracker(),r=state();r.match.hand=[{id:'held'}];t.update(r);
 r.match.phase='decision';r.match.hand.push({id:'drawn'});assert.deepEqual(t.update(r),[{kind:'draw',cardId:'drawn'}]);
 assert.deepEqual(t.update(r),[]);r.match.hand.shift();assert.deepEqual(t.update(r),[]);
});
