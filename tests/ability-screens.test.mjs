import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIALS } from '../public/cards.js';
import { ABILITY_CARDS, abilitySteps } from '../public/ability-screens.js';
test('ability collection covers every special and numbered expansion interaction',()=>{
  for(const card of SPECIALS) assert.ok(ABILITY_CARDS.some(c=>c.id===card.id),card.id);
  for(const id of ['yellow-0-14','yellow-7-extra','yellow-8-extra','black-14','yellow-14']) assert.ok(ABILITY_CARDS.some(c=>c.id===id));
  assert.equal(new Set(ABILITY_CARDS.map(c=>c.id)).size,ABILITY_CARDS.length);
});
test('First Mate offers all six captured pirate powers and independent declines',()=>{
  const steps=abilitySteps(SPECIALS.find(c=>c.id==='first-mate'));
  for(const card of SPECIALS.filter(c=>c.power)) {
    const captured=steps.filter(s=>s.captured===card.id);
    assert.equal(captured.length,abilitySteps(card).length);
    assert.ok(captured[0].optional);
  }
  assert.ok(steps.find(s=>s.captured==='mary'&&s.private));
});
test('multi-step powers require private draw/discard and unseen forced-card choices',()=>{
  const bendt=abilitySteps(SPECIALS.find(c=>c.id==='bendt'));
  assert.equal(bendt.length,2);assert.equal(bendt[1].count,2);assert.ok(bendt[1].private);
  const mary=abilitySteps(SPECIALS.find(c=>c.id==='mary'));
  assert.equal(mary.length,2);assert.ok(mary[1].private);
  const wild=abilitySteps(SPECIALS.find(c=>c.id==='wild'));
  assert.deepEqual(wild[0].options,['Yellow','Purple','Green']);
});
