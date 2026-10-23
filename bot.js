import {playError,leadSuit,resolvePlankTrick} from './rules.js';
const strength=(card,choice)=>card.type==='number'?(Number(choice??card.value)/15)*(card.suit==='black'?.9:.55):card.type==='skull-king'?.97:card.type==='first-mate'?.88:card.type==='pirate'||card.type==='tigress'&&choice==='pirate'?.82:card.type==='mermaid'?.72:0;
export function bidForHand(hand) {
  const estimate=hand.reduce((sum,c)=>sum+strength(c,c.type==='tigress'?'pirate':undefined),0);
  return Math.max(0,Math.min(hand.length,Math.round(estimate)));
}
// Deliberately accepts no opponents' hands or deck order.
export function chooseBotPlay({hand,plays=[],bid=0,won=0,playersAfter=0,forcedCardId}) {
  const state={phase:'play',turn:'bot',hands:{bot:hand},plays,forced:forcedCardId?{bot:forcedCardId}:{}};
  const lead=leadSuit(plays),need=bid>won,candidates=[];
  for(const card of hand) {
    const choices=card.choices|| (card.suit==='wild'&&!lead?['yellow','purple','green']:[undefined]);
    for(const choice of choices) {
      if(playError(state,'bot',card.id,choice)) continue;
      const power=strength(card,choice);
      let wins=null;
      try {const result=resolvePlankTrick([...plays,{playerId:'bot',card,choice}]);wins=result.winnerId==='bot';} catch { /* Complex effects use a conservative estimate until their resolver exists. */ }
      const chance=wins===false?0:wins===true?Math.pow(.35+.65*power,playersAfter):power/(1+playersAfter*.3);
      // Last to act: save the strongest winners; shed the strongest guaranteed loser.
      const utility=need?chance*100-power*12:(1-chance)*100+power*8;
      candidates.push({cardId:card.id,choice,utility,reason:forcedCardId?'Mary requires this card.':need?'Pursue the remaining bid while conserving stronger cards.':'Avoid another trick; shed strength when safe.',winsNow:wins});
    }
  }
  candidates.sort((a,b)=>b.utility-a.utility);
  return candidates[0]||null;
}
