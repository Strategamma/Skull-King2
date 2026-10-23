import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseBotPlay,bidForHand} from '../public/bot.js';
import {numberCard,SPECIALS,makeDeck} from '../public/cards.js';
import {playError} from '../public/rules.js';
const escape=SPECIALS.find(c=>c.id==='escape');
const hand=[numberCard('black',9),numberCard('black',13),numberCard('yellow',6),escape];
const plays=[{playerId:'a',card:numberCard('black',8)}];
test('bot follows suit, takes cheapest winning card and protects an exact bid',()=>{
 assert.equal(chooseBotPlay({hand,plays,bid:2,won:1}).cardId,'black-9');
 assert.equal(chooseBotPlay({hand,plays,bid:1,won:1}).cardId,escape.id);
 assert.equal(chooseBotPlay({hand,plays,bid:0,won:0,forcedCardId:'yellow-6'}).cardId,'yellow-6');
});
test('bot respects card modes, Mary and suit legality across the deck',()=>{
 const deck=makeDeck({expansion:true});
 for(let offset=0;offset<deck.length;offset++) {
  const cards=[deck[offset],deck[(offset+17)%deck.length],deck[(offset+31)%deck.length]];
  for(const lead of ['black','yellow',null]) {
   const publicPlays=lead?[{playerId:'a',card:numberCard(lead,12)}]:[];
   const decision=chooseBotPlay({hand:cards,plays:publicPlays,bid:offset%3,won:0,playersAfter:3});
   assert.ok(decision);
   assert.equal(playError({phase:'play',turn:'bot',hands:{bot:cards},plays:publicPlays},'bot',decision.cardId,decision.choice),null);
  }
 }
 assert.equal(chooseBotPlay({hand:[]}),null);
});
test('bot estimates bids within the actual hand size without mutating input',()=>{
 const snapshot=JSON.stringify(hand);assert.ok(bidForHand(hand)>=0&&bidForHand(hand)<=hand.length);
 chooseBotPlay({hand,plays,bid:2,won:0});assert.equal(JSON.stringify(hand),snapshot);
 assert.equal(bidForHand([escape]),0);
});
