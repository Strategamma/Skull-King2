// Shared pure validation. The future room server must call this before committing any play.
export function leadSuit(plays) {
  let lead=null, established=false;
  for(const {card,choice} of plays) {
    if(['kraken','whale','stingray'].includes(card.type)) { if(!established) established=true; continue; } // Host-selected FAQ: preserve an established suit.
    if(established) continue;
    if(card.type==='number') { lead=card.suit==='wild'?choice:card.suit; established=true; }
    else if(!['escape','loot','locker','plank','volley','stingray'].includes(card.type) && !(card.type==='tigress'&&choice==='escape')) established=true;
  }
  return lead;
}
export function playError(state,playerId,cardId,choice) {
  if(state.phase!=='play') return 'Wait for the card-playing phase.';
  if(state.turn!==playerId) return 'Wait for your turn.';
  const hand=state.hands[playerId]||[], card=hand.find(c=>c.id===cardId);
  if(!card) return 'That card is no longer in your hand.';
  if(state.forced?.[playerId] && state.forced[playerId]!==cardId) return 'Mary Thorne requires you to play the marked card.';
  if(card.choices && !card.choices.includes(choice)) return 'Choose how this card will be played.';
  const lead=leadSuit(state.plays);
  if(card.suit==='wild' && !lead && !['yellow','purple','green'].includes(choice)) return 'Choose yellow, purple or green for Wild 15.';
  if(!state.forced?.[playerId] && lead && card.type==='number') {
    const follows=card.suit===lead || card.suit==='wild'&&lead!=='black';
    const hasLead=hand.some(c=>c.type==='number'&&(c.suit===lead||c.suit==='wild'&&lead!=='black'));
    if(!follows && hasLead) return `Follow ${lead}, or play a special card.`;
  }
  return null;
}
export function commitPlay(state,playerId,cardId,choice) {
  const error=playError(state,playerId,cardId,choice);
  if(error) return {ok:false,error,state};
  const card=state.hands[playerId].find(c=>c.id===cardId);
  return {ok:true,state:{...state,turn:null,phase:'review',hands:{...state.hands,[playerId]:state.hands[playerId].filter(c=>c.id!==cardId)},plays:[...state.plays,{playerId,card,choice}]}};
}
export function scoreRound({bid,won,dealt,bonuses=[],wager=0}) {
  const exact=bid===won;
  const bidPoints=bid===0?(exact?10:-10)*dealt:exact?20*bid:-10*Math.abs(won-bid);
  const bonus=exact?bonuses.reduce((sum,b)=>sum+b.points,0)+wager:wager?-wager:0;
  return {bidPoints,bonus,total:bidPoints+bonus,breakdown:exact?bonuses:[],exact};
}
// Capture attribution is separate from awarding: bids are checked only at round end.
export function captureBonuses({plays,winnerId,winningCardId,removedIds=[]}) {
  const events=[],removed=new Set(removedIds),remaining=plays.filter(p=>!removed.has(p.card.id));
  const winner=remaining.find(p=>p.card.id===winningCardId&&p.playerId===winnerId);
  const add=(playerId,points,label,requires=[playerId])=>events.push({playerId,points,label,requires});
  const pirate=p=>p.card.type==='pirate'||p.card.type==='tigress'&&p.choice==='pirate';
  if(winner) for(const p of remaining) {
    if(p.card.bonus) add(winnerId,p.card.bonus,p.card.name);
    if(p.card.id===winningCardId) continue;
    if(p.card.type==='mermaid'&&pirate(winner)) add(winnerId,20,'Pirate captures Mermaid');
    if(pirate(p)&&winner.card.type==='skull-king') add(winnerId,30,'Skull King captures Pirate');
    if(p.card.type==='skull-king'&&winner.card.type==='mermaid') add(winnerId,40,'Mermaid captures Skull King');
    if(p.card.type==='first-mate'&&['skull-king','mermaid'].includes(winner.card.type)) add(winnerId,30,'First Mate captured');
    if(p.card.type==='loot'&&p.playerId!==winnerId) {
      add(winnerId,20,'Loot alliance',[winnerId,p.playerId]);add(p.playerId,20,'Loot alliance',[winnerId,p.playerId]);
    }
  }
  const locker=plays.find(p=>p.card.type==='locker');
  if(locker) for(const p of plays) if(['kraken','whale','stingray'].includes(p.card.type)) add(locker.playerId,20,'Locker destroys sea creature');
  return events;
}
export function awardedBonuses(events,exactBids) {
  return events.filter(e=>e.requires.every(id=>exactBids[id]===true));
}

export function marySelection({round,finalTrick=false,hands,targetId,cardId}) {
  if(round===10||finalTrick) throw new Error('Mary has no next trick to affect in this scenario.');
  if(!hands[targetId]?.some(c=>c.id===cardId)) throw new Error('Choose a card from the target hand.');
  return {playerId:targetId,cardId};
}
export function markMaryCard(state,selection) {
  if(!state.hands[selection.playerId]?.some(c=>c.id===selection.cardId)) throw new Error('The marked card is no longer in hand.');
  return {...state,forced:{...state.forced,[selection.playerId]:selection.cardId},selected:{...state.selected,[selection.playerId]:selection.cardId}};
}

// Resolves ordinary tricks and Plank only. Creature/Volley sequencing needs its own pipeline.
export function resolvePlankTrick(plays,plankTargetId) {
  if(plays.some(p=>['kraken','whale','stingray','locker','volley'].includes(p.card.type))) throw new Error('Creature/Volley resolution is not implemented in this resolver.');
  const pirate=p=>p.card.type==='pirate'||p.card.type==='tigress'&&p.choice==='pirate';
  const targets=plays.filter(pirate);
  let removedIds=[];
  if(plays.some(p=>p.card.type==='plank')&&targets.length) {
    const id=plankTargetId??(targets.length===1?targets[0].card.id:null);
    if(!targets.some(p=>p.card.id===id)) throw new Error('Choose an eligible pirate for Walk the Plank.');
    removedIds=[id];
  } else if(plankTargetId) throw new Error('No eligible Plank removal.');
  const remaining=plays.filter(p=>!removedIds.includes(p.card.id));
  const king=remaining.find(p=>p.card.type==='skull-king'),mermaid=remaining.find(p=>p.card.type==='mermaid');
  const mate=remaining.find(p=>p.card.type==='first-mate'),ordinary=remaining.find(pirate);
  let winner=king?(mermaid||king):mate?(mermaid||mate):ordinary||mermaid;
  if(!winner) {
    const lead=leadSuit(remaining),numbers=remaining.filter(p=>p.card.type==='number');
    const eligible=numbers.filter(p=>p.card.suit==='black');
    if(!eligible.length) eligible.push(...numbers.filter(p=>p.card.suit===lead||p.card.suit==='wild'&&lead!=='black'));
    winner=eligible.reduce((best,p)=>!best||Number(p.choice??p.card.value)>Number(best.choice??best.card.value)?p:best,null);
    if(!winner) winner=remaining.find(p=>['escape','loot'].includes(p.card.type)||p.card.type==='tigress'&&p.choice==='escape');
  }
  return {winnerId:winner?.playerId??null,winningCardId:winner?.card.id??null,removedIds,bonuses:captureBonuses({plays,winnerId:winner?.playerId,winningCardId:winner?.card.id,removedIds})};
}
export function recordResolvedTrick(state,trickId,result) {
  if(!trickId) throw new Error('A stable trick ID is required.');
  if(Object.hasOwn(state.resolvedTricks||{},trickId)) return state;
  const won={...state.won};
  if(result.winnerId) won[result.winnerId]=(won[result.winnerId]||0)+1;
  return {...state,won,bonusEvents:[...(state.bonusEvents||[]),...result.bonuses],resolvedTricks:{...state.resolvedTricks,[trickId]:result}};
}
