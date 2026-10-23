export const SUITS = {
  black: { name: 'Jolly Roger', symbol: '☠' }, yellow: { name: 'Treasure Chest', symbol: '▣' },
  purple: { name: 'Pirate Map', symbol: '▧' }, green: { name: 'Parrot', symbol: '❧' },
};
const special = (id,name,rank,ability,extra={}) => ({id,name,rank,type:id,kind:id,art:`${id}.jpg`,ability,...extra});
export const SPECIALS = [
  special('skull-king','Skull King','♛','Beats numbered cards and pirates. Loses to a Mermaid, including when a pirate is also present. If you make your bid, earn +30 per captured pirate.',{art:'skull-king.png'}),
  special('rosie','Rosie D’Laney','⚔','Pirate: beats numbered cards and Mermaids; the first pirate wins among standard pirates. After winning with Rosie, choose anyone, including yourself, to lead next. Use immediately; no effect after the final trick.',{type:'pirate',power:'lead'}),
  special('bendt','Bendt the Bandit','⚔','Pirate. After winning with Bendt, draw two undealt cards, then discard two. Use immediately, before the next trick. No benefit after the final trick.',{type:'pirate',power:'exchange'}),
  special('rascal','Rascal of Roatan','⚔','Pirate. After winning with Rascal, optionally wager 10 or 20 points on making your exact bid. Gain the wager if correct; lose it if incorrect. You may decline.',{type:'pirate',power:'wager'}),
  special('juanita','Juanita Jade','⚔','Pirate. After winning with Juanita, privately inspect the cards not dealt this round. Do not reveal that information to the table. Use immediately; no benefit after the final trick.',{type:'pirate',power:'peek'}),
  special('harry','Harry the Giant','⚔','Pirate. After winning with Harry, change your bid by +1 or −1, or keep it unchanged. May be used after the final trick. Keep the bid within the number of cards dealt.',{type:'pirate',power:'bid'}),
  special('tigress','Tigress','⚔ / ⚐','When you play her, choose Pirate or Escape immediately. She follows that role for this trick. Captured as a pirate she can award a pirate bonus; as an escape she does not.',{choices:['pirate','escape']}),
  special('mermaid','Mermaid','♆','Beats all numbers and the Skull King, but loses to pirates. First Mermaid wins ties. With a pirate and Skull King present, the Mermaid wins. Capture the King for +40 if your bid is exact.'),
  special('escape','Escape','⚐','Usually loses. If all cards are Escapes or act as Escapes, the first wins. When leading, pass suit selection to the next non-Escape play.'),
  special('loot','Loot','▣','Acts as an Escape. Forms an alliance with the trick winner: both receive +20 only if both make their bids. If it wins its own trick, no alliance is formed.',{advanced:true}),
  special('kraken','Kraken','≈','Destroys the trick: no one wins it. The player who would otherwise have won leads next. With multiple sea creatures, the last creature applies, unless Davy Jones’ Locker removes them.',{advanced:true}),
  special('whale','White Whale','≈','Destroys special-card ranks and removes number-card suits: highest number wins, first played breaks ties. If only specials were played, discard the trick. Last sea creature applies unless Locker cancels them.',{advanced:true}),
  special('mary','Mary Thorne','⚔','Pirate. After winning with Mary, privately view any player’s hand, including your own, and choose a card. It is preselected and must be played next trick despite suit restrictions. House rule: unavailable throughout round 10 or when there is no next trick.',{type:'pirate',power:'force',expansion:true}),
  special('first-mate','First Mate Con','⚔','Beats standard pirates; loses to Mermaids and the Skull King. After winning, you may use every captured pirate’s power, resolving each separately. No bonus for capturing pirates. King or Mermaid captures him for +30 if their bid is exact.',{art:'first-mate.png',expansion:true}),
  special('plank','Walk the Plank','⚔','Cannot win. At the end of the trick, remove one standard pirate if present; choose if several. It cannot remove King, First Mate, or a non-pirate card. Removed pirates award no capture bonus.',{expansion:true}),
  special('stingray','Spotted Stingray','≈','Like White Whale, but the lowest numbered card wins; first played breaks ties. Special-card ranks and suits do not decide it. The last sea creature applies unless Locker removes them.',{expansion:true}),
  special('volley','The Last Volley','●','Cannot win itself. After everyone plays, play one extra card, then skip the final trick of the round. If used on the final trick, there is no extra card to play.',{expansion:true}),
  special('locker','Davy Jones’ Locker','⚓','Cannot win. Removes all sea creatures at trick end, regardless of play order. Resolve remaining cards normally. Its player earns +20 per removed creature only if their bid is exact.',{expansion:true}),
  special('wild','Wild Monkey 15','15','Suited 15: follows a yellow, purple or green lead as that suit. When leading, choose one of those three suits. Never black; loses to black trump. With White Whale, its 15 is the highest number.',{type:'number',suit:'wild',value:15,expansion:true}),
];
for(const card of SPECIALS) if(card.type==='pirate') card.ability+=' Standard pirates beat numbered cards and Mermaids, lose to Skull King and First Mate, and tie in play order. Capture a Mermaid for +20 if your bid is exact.';
export function numberCard(suit,value,id=`${suit}-${value}`,extra={}) {
  const bonus=value===14 ? suit==='black'?20:10 : 0;
  return {id,type:'number',suit,kind:suit,value,rank:String(value),name:`${suit[0].toUpperCase()+suit.slice(1)} ${value}`,symbol:SUITS[suit].symbol,bonus,
    ability:`${SUITS[suit].name} (${suit}), rank ${value}. ${suit==='black'?'Black is trump. ':''}Follow the lead suit when choosing a number card if you have it. ${bonus?`Capture this standard 14 for +${bonus} bonus points only if your bid is exact. You may capture your own 14.`:''}`,...extra};
}
export function makeDeck({expansion=false,players=10}={}) {
  const deck=Object.keys(SUITS).flatMap(suit=>Array.from({length:14},(_,i)=>numberCard(suit,i+1)));
  for (const card of SPECIALS) {
    if (card.expansion && !expansion || card.advanced && !expansion || players===2 && ['loot','plank','wild'].includes(card.id)) continue;
    const count=card.id==='escape'?5:card.id==='mermaid'||card.id==='loot'?2:1;
    for(let i=0;i<count;i++) deck.push({...card,id:`${card.id}-${i}`});
  }
  if(expansion) for(const suit of Object.keys(SUITS)) {
    for(const value of [7,8]) deck.push(numberCard(suit,value,`${suit}-${value}-extra`,{bonus:value===7?-5:5,ability:`Extra ${suit} ${value}: first played breaks equal-rank ties. Capturing this card ${value===7?'subtracts 5':'adds 5'} bonus points, only if your bid is exact.`}));
    if(players!==2) deck.push(numberCard(suit,0,`${suit}-0-14`,{name:`${suit[0].toUpperCase()+suit.slice(1)} 0/14`,rank:'0/14',bonus:0,choices:[0,14],ability:'Choose 0 or 14 when playing. Remains a suited card and must follow suit. No 14 capture bonus. First played wins equal-rank ties.'}));
  }
  return deck;
}
