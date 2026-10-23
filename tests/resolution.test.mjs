import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIALS,numberCard} from '../public/cards.js';
import {resolvePlankTrick,recordResolvedTrick,awardedBonuses,scoreRound,marySelection,markMaryCard,playError} from '../public/rules.js';
const special=id=>SPECIALS.find(c=>c.id===id);
const play=(playerId,id)=>({playerId,card:special(id)});
test('Plank removes a pirate before King capture bonuses, records exactly once',()=>{
 const plays=[play('a','skull-king'),play('b','rosie'),play('c','bendt'),play('d','plank')];
 assert.throws(()=>resolvePlankTrick(plays),/eligible/);
 const result=resolvePlankTrick(plays,'rosie');assert.equal(result.winnerId,'a');assert.deepEqual(result.removedIds,['rosie']);assert.equal(result.bonuses.length,1);assert.equal(result.bonuses[0].points,30);
 const recorded=recordResolvedTrick({},'round-6-trick-2',result);assert.equal(recordResolvedTrick(recorded,'round-6-trick-2',result),recorded);assert.equal(recorded.won.a,1);
 const bonuses=awardedBonuses(recorded.bonusEvents,{a:true});assert.equal(scoreRound({bid:2,won:2,dealt:6,bonuses}).total,70);assert.equal(scoreRound({bid:2,won:3,dealt:6,bonuses}).bonus,0);
 assert.throws(()=>resolvePlankTrick(plays,'skull-king'),/eligible/);
});
test('Plank changes the winner when it removes the first pirate',()=>{const result=resolvePlankTrick([play('a','rosie'),play('b','bendt'),play('c','mermaid'),play('d','plank')],'rosie');assert.equal(result.winnerId,'b');assert.equal(result.bonuses[0].points,20);});
test('Mary reveals/selects a real target card, preselects it and overrides suit; round ten disabled',()=>{
 const yellow=numberCard('yellow',6),black=numberCard('black',9),hands={b:[yellow,black]};
 const selection=marySelection({round:6,hands,targetId:'b',cardId:yellow.id});
 const state=markMaryCard({hands,phase:'play',turn:'b',plays:[{card:numberCard('black',12)}]},selection);
 assert.equal(state.selected.b,yellow.id);assert.equal(playError(state,'b',yellow.id),null);assert.match(playError(state,'b',black.id),/Mary/);
 assert.throws(()=>marySelection({round:10,hands,targetId:'b',cardId:yellow.id}),/no next trick/);
 assert.throws(()=>marySelection({round:6,finalTrick:true,hands,targetId:'b',cardId:yellow.id}),/no next trick/);
 assert.throws(()=>marySelection({round:6,hands,targetId:'b',cardId:'missing'}),/target hand/);
});
