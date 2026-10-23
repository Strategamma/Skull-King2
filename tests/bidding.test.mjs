import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBidding,lockBid,visibleBids,waitingFor} from '../public/bidding.js';
test('bids must be integral, in range, from a known seat and locked once',()=>{const s=createBidding(['a','b'],6);for(const value of [-1,7,1.5])assert.throws(()=>lockBid(s,'a',value));assert.throws(()=>lockBid(s,'x',1));const t=lockBid(s,'a',0);assert.equal(s.bids.a,undefined);assert.throws(()=>lockBid(t,'a',1));});
test('keep other bids hidden until every seat locks, then reveal together',()=>{let s=lockBid(createBidding(['a','b','c'],6),'a',2);assert.equal(visibleBids(s,'b')[0].bid,null);assert.equal(visibleBids(s,'a')[0].bid,2);assert.deepEqual(waitingFor(s),['b','c']);s=lockBid(lockBid(s,'b',0),'c',6);assert.deepEqual(visibleBids(s,'b').map(p=>p.bid),[2,0,6]);});
