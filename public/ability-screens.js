import { SPECIALS, makeDeck } from './cards.js';

export const ABILITY_CARDS = [...SPECIALS, ...makeDeck({expansion:true}).filter(c=>['yellow-0-14','yellow-7-extra','yellow-8-extra','black-14','yellow-14'].includes(c.id))];
const crew = ['Captain (you)','Sam','Maya','Alex'];
const step = (title,hint,options,extra={})=>({title,hint,options,...extra});
export function abilitySteps(card) {
  switch(card.kind) {
    case 'rosie': return [step('Who leads next?','Choose any player, including yourself.',crew)];
    case 'bendt': return [step('Draw from the reserves','Your two drawn cards are private. If fewer than two reserves remain, draw only what remains.',['Reveal drawn cards']),step('Choose two discards','Private sample: Black 9 and Yellow 6 were drawn. Return two cards from the enlarged hand.',['Black 9','Yellow 6','Green 4','Escape'],{count:2,private:true})];
    case 'rascal': return [step('Back your bid','An exact bid wins your wager; missing it loses the same points.',['No wager','Wager 10','Wager 20'])];
    case 'juanita': return [step('For your eyes only','Inspect the undealt cards privately. In this sample reserve: Black 9, Yellow 6 and Escape.',['Finish private inspection'],{private:true})];
    case 'harry': return [step('Adjust your prediction','Sample: 2 bid in a six-card round. The live range must remain 0–6.',['Lower to 1','Keep 2','Raise to 3'])];
    case 'tigress': return [step('Choose her allegiance','Declare her role as you play. This choice lasts for the entire trick.',['Pirate','Escape'])];
    case 'mary': return [step('Choose a player','Choose anyone, including yourself. You will privately see their hand.',crew),step('Choose their next card','Private sample hand. Your choice is preselected for their next trick and must be played, even against suit restrictions. Unavailable in round 10.',['Yellow 6','Black 9','Escape'],{private:true})];
    case 'first-mate': return [step('Claim captured powers','This review scenario captures all six standard pirates. In a match, only captured powers appear.',['Resolve captured powers','Decline all powers']), ...SPECIALS.filter(c=>c.power).flatMap(c=>abilitySteps(c).map((s,i)=>({...s,title:`${c.name} · ${s.title}`,captured:c.id,optional:i===0})))];
    case 'plank': return [step('Send a pirate overboard','Sample trick has two eligible standard pirates. King, First Mate and non-pirates are never targets.',['Rosie D’Laney','Bendt the Bandit'])];
    case 'wild': return [step('Declare your lead suit','When leading, choose yellow, purple or green. Never black. When following, the suit is determined by the lead.',['Yellow','Purple','Green'])];
    case 'volley': return [step('Fire your extra card','After all players have played, choose one remaining card. You will sit out the final trick. On the final trick, no extra play is offered.',['Yellow 6','Escape','Green 4'])];
  }
  if(card.choices) return [step('Choose the card’s value','It remains yellow and must follow suit. Neither choice earns the standard 14 bonus.',['Play as 0','Play as 14'])];
  return [];
}
const timing = card => card.power || card.kind==='first-mate' ? 'AFTER WINNING THE TRICK' : ['plank','locker','kraken','whale','stingray','volley'].includes(card.kind) ? 'AT TRICK RESOLUTION' : card.choices || card.kind==='wild' ? 'WHEN YOU PLAY' : 'AUTOMATIC EFFECT';
const outcome = {
  'skull-king':['The King claims the trick','Sample: two pirates captured · +60 potential bonus. Award only if your bid is exact.'],
  mermaid:['The King meets his match','Sample: Skull King captured · +40 potential bonus. Award only if your bid is exact.'],
  escape:['Slip past the battle','Escape usually loses. If every play acts as an Escape, the first wins.'],
  loot:['An alliance is sealed','Sample: you and Sam each stand to gain +20. Both bids must be exact; otherwise neither gets the alliance bonus.'],
  kraken:['Dragged into the depths','No trick awarded. The player who would have won without the creatures leads next.'],
  whale:['Only the numbers survive','Sample: Yellow 14 beats Black 9. Suits and special ranks are ignored; the first highest number wins.'],
  stingray:['The smallest slips through','Sample: Green 2 beats Yellow 14. The first lowest number wins; suits and special ranks are ignored.'],
  locker:['Sea creatures sent to the Locker','Sample: Kraken and White Whale removed. Resolve the remaining cards normally; +40 potential bonus for the Locker’s player, subject to an exact bid.'],
};

export function mountAbilityScreens({open,content,learn,onResolve=()=>{}}) {
  let current, page=0, selections=[], picked=[], finished=false;
  const expansionCard=c=>c.expansion||c.advanced||c.id.endsWith('-extra')||c.id.includes('-0-14');
  function gallery() {
    open(`<section class="power-library"><span class="eyebrow">THE CREW & THE CURSED</span><h2>Every card. Every power.</h2><p>Choose a card to try its ability screen. Sample decisions only; your table and scores stay unchanged.</p><button class="text-button" id="power-learn">How to play →</button><div class="power-filter" role="group" aria-label="Card collection"><button data-collection="base" aria-pressed="false">Base</button><button data-collection="expansion" aria-pressed="false">Expansion</button><button data-collection="all" aria-pressed="true">All</button></div><div class="power-grid"></div></section>`);
    content.querySelector('#power-learn').onclick=learn;
    function populate(filter='all') {
      const cards=ABILITY_CARDS.filter(c=>filter==='all'||(filter==='base'?!expansionCard(c):expansionCard(c)));
      content.querySelector('.power-grid').innerHTML=cards.map(c=>`<button data-power="${c.id}" class="power-tile ${c.type==='pirate'||['skull-king','first-mate','tigress'].includes(c.kind)?'red':c.kind==='mermaid'?'blue':''}">${c.art?`<img src="/assets/${c.art}" alt="" loading="lazy">`:`<span class="power-number">${c.rank}</span>`}<strong>${c.name}</strong><small>${c.advanced?'ADVANCED':expansionCard(c)?'EXPANSION':'BASE'}</small></button>`).join('');
      content.querySelectorAll('[data-power]').forEach(b=>b.onclick=()=>show(b.dataset.power));
    }
    content.querySelectorAll('[data-collection]').forEach(b=>b.onclick=()=>{content.querySelectorAll('[data-collection]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));populate(b.dataset.collection);});
    populate();content.closest('dialog').scrollTop=0;
  }
  function show(id) {current=ABILITY_CARDS.find(c=>c.id===id);page=0;selections=[];picked=[];finished=false;render();focusStep();}
  function focusStep() {
    content.closest('dialog').scrollTop=0;
    const heading=content.querySelector('.power-decision h3');
    heading.tabIndex=-1;heading.focus({preventScroll:true});
  }
  function render() {
    const card=current, steps=abilitySteps(card), active=steps[page];
    const declined=selections.includes('Power declined')||selections[0]?.includes('Decline all powers');
    const result=declined?['Power declined','No optional powers used.']:outcome[card.kind]||['Power resolved',selections.filter(Boolean).join(' · ')||'This card’s capture bonus is recorded separately and awarded only when the bid is exact.'];
    open(`<section class="power-screen ${card.type==='pirate'||['skull-king','first-mate','tigress'].includes(card.kind)?'red':card.kind==='mermaid'?'blue':''}"><button class="text-button power-back" id="power-back">← All abilities</button><div class="power-hero">${card.art?`<img src="/assets/${card.art}" alt="${card.name}">`:`<span class="power-number">${card.rank}</span>`}<div><span class="eyebrow">${timing(card)}</span><h2>${card.name}</h2><span class="power-preview">ABILITY SCREEN PREVIEW</span></div></div><details class="power-rules"><summary>Card rules & bonuses</summary><p>${card.ability}</p></details><div class="power-decision ${finished?'resolved':''}" aria-live="polite">${finished?`<span class="power-seal" aria-hidden="true">${['kraken','whale','stingray'].includes(card.kind)?'≈':'✦'}</span><h3>${result[0]}</h3><p>${result[1]}</p><p class="power-sample">Preview complete · no live game changes</p><button class="primary" id="power-replay">Try again</button>`:active?`<span class="power-step">${active.private?'PRIVATE · ':''}STEP ${page+1} / ${steps.length}</span><h3>${active.title}</h3><p>${active.hint}</p><div class="power-options ${active.hidden?'unseen':''}">${active.options.map((option,i)=>`<button data-option="${i}" aria-pressed="${picked.includes(i)}">${active.hidden?'<span aria-hidden="true">⚓</span>':active.private&&active.options.includes('Yellow 6')?`<span class="revealed-choice ${i===0?'yellow':i===1?'black':'escape'}" aria-hidden="true">${i===0?'6̲ ▣':i===1?'9̲ ☠':'⚐'}</span>`:''}${option}</button>`).join('')}</div><button id="power-confirm" class="primary" ${picked.length===(active.count||1)?'':'disabled'}>${active.count?`Discard ${active.count} cards`:page===steps.length-1?'Confirm choice':'Continue'}</button>`:`<span class="power-step">NO CHOICE REQUIRED</span><h3>Watch the effect unfold</h3><p>${card.ability}</p><button class="primary" id="power-confirm">Preview resolution</button>`}</div>${!finished&&(card.power&&page===0||active?.optional)?'<button class="text-button" id="power-skip">Decline this power</button>':''}<p class="power-sample">${card.power?'Pirate powers are optional. This preview assumes the pirate won and there is another trick, except Harry who can adjust after the final trick.':'Illustrative scenario · live timing and eligible choices will come from the match engine.'}</p></section>`);
    content.querySelector('#power-back').onclick=gallery;
    content.querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.option);picked=active.count?(picked.includes(i)?picked.filter(x=>x!==i):picked.length<active.count?[...picked,i]:picked):[i];render();content.querySelector(`[data-option="${i}"]`).focus({preventScroll:true});});
    const confirm=content.querySelector('#power-confirm');
    if(confirm) confirm.onclick=()=>{
      if(active) selections[page]=`${active.title}: ${picked.map(i=>active.options[i]).join(', ')}`;
      if(current.kind==='first-mate'&&page===0&&picked[0]===1) finished=true;
      else if(page<steps.length-1) {page++;picked=[];} else finished=true;
      if(finished)onResolve(current);render();focusStep();
    };
    const skip=content.querySelector('#power-skip');if(skip) skip.onclick=()=>{if(card.kind==='first-mate'){const captured=active.captured;do {page++;} while(steps[page]?.captured===captured);selections.push(`${captured}: declined`);picked=[];finished=page>=steps.length;}else {selections=['Power declined'];finished=true;}render();focusStep();};
    const replay=content.querySelector('#power-replay');if(replay) replay.onclick=()=>show(card.id);
  }
  return {gallery,show};
}
