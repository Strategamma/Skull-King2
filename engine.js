import {makeDeck} from './cards.js';
import {playError,leadSuit,captureBonuses,scoreRound,awardedBonuses} from './rules.js';
import {bidForHand,chooseBotPlay} from './bot.js';

const seas=['kraken','whale','stingray'];
const pirate=p=>p.card.type==='pirate'||p.card.type==='tigress'&&p.choice==='pirate';
const rank=p=>p.card.suit==='wild'?15:Number(p.card.choices?p.choice:p.card.value);
const option=(value,label,card)=>({value,label,...(card?{card}: {})});
export function createMatch(players,{expansion=false,rng=Math.random}={}) {
 if(players.length<2||players.length>10||new Set(players).size!==players.length) throw Error('Choose 2–10 distinct players.');
 const m={players:[...players],expansion,round:0,revision:0,scores:Object.fromEntries(players.map(id=>[id,0])),history:[]};
 startRound(m,rng);return m;
}
function startRound(m,rng=Math.random) {
 m.round++;const deck=makeDeck({expansion:m.expansion,players:m.players.length});
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 m.dealt=Math.min(m.round,Math.floor(deck.length/m.players.length));m.hands={};m.bids={};m.won={};m.wagers={};m.bonusEvents=[];m.forced={};m.skip=[];m.trick=1;m.plays=[];m.result=null;m.decision=null;
 for(const id of m.players){m.hands[id]=deck.splice(0,m.dealt);m.won[id]=0;m.wagers[id]=0;}
 m.reserve=deck;m.phase='bidding';m.leader=m.players[(m.round-1)%m.players.length];m.turn=null;
}
function ordered(m,leader){const n=m.players.indexOf(leader);return [...m.players.slice(n),...m.players.slice(0,n)].filter(id=>!m.skip.includes(id)||m.trick!==m.dealt);}
function startTrick(m){m.phase='play';m.plays=[];m.result=null;m.order=ordered(m,m.leader);m.index=0;m.turn=m.order[0];m.volleyDone=[];m.removed=[];m.plankDone=[];}
function decision(m,playerId,kind,title,options,extra={}){m.phase='decision';m.turn=null;m.decision={playerId,kind,title,description:title,options,...extra};}
function normalWinner(plays,establishedLead=leadSuit(plays)){
 const king=plays.find(p=>p.card.type==='skull-king'),mermaid=plays.find(p=>p.card.type==='mermaid'),mate=plays.find(p=>p.card.type==='first-mate'),p=plays.find(pirate);
 if(king)return mermaid||king;if(mate)return mermaid||mate;if(p)return p;if(mermaid)return mermaid;
 const lead=establishedLead,nums=plays.filter(p=>p.card.type==='number'),black=nums.filter(p=>p.card.suit==='black');
 const eligible=black.length?black:nums.filter(p=>!lead||p.card.suit===lead||p.card.suit==='wild'&&lead!=='black');
 return eligible.reduce((best,p)=>!best||rank(p)>rank(best)?p:best,null)||plays.find(p=>['escape','loot'].includes(p.card.type)||p.card.type==='tigress'&&p.choice==='escape')||null;
}
function finishPlays(m){
 const volley=m.plays.find(p=>p.card.type==='volley'&&!m.volleyDone.includes(p.card.id));
 if(volley){m.volleyDone.push(volley.card.id);if(m.trick<m.dealt&&m.hands[volley.playerId].length){m.skip.push(volley.playerId);m.phase='play';m.turn=volley.playerId;m.extra=true;return;}}
 const plank=m.plays.find(p=>p.card.type==='plank'&&!m.plankDone.includes(p.card.id));
 if(plank){m.plankDone.push(plank.card.id);const targets=m.plays.filter(p=>pirate(p)&&!m.removed.includes(p.card.id));if(targets.length){decision(m,plank.playerId,'plank','Choose a pirate to walk the plank',targets.map(p=>option(p.card.id,p.card.name,p.card)));return;}}
 resolve(m);
}
function resolve(m){
 let remaining=m.plays.filter(p=>!m.removed.includes(p.card.id));const locker=remaining.some(p=>p.card.type==='locker');
 if(locker)remaining=remaining.filter(p=>!seas.includes(p.card.type));
 const creature=remaining.filter(p=>seas.includes(p.card.type)).at(-1);let winner=normalWinner(remaining.filter(p=>!seas.includes(p.card.type)),leadSuit(m.plays));
 const nextLeader=winner?.playerId||m.order[0];
 if(creature?.card.type==='kraken')winner=null;
 else if(creature){const nums=remaining.filter(p=>p.card.type==='number');winner=nums.reduce((best,p)=>!best||(creature.card.type==='whale'?rank(p)>rank(best):rank(p)<rank(best))?p:best,null);}
 const bonuses=captureBonuses({plays:m.plays,winnerId:winner?.playerId,winningCardId:winner?.card.id,removedIds:[...m.removed,...(locker?m.plays.filter(p=>seas.includes(p.card.type)).map(p=>p.card.id):[])]});
 // A creature destroys capture relationships; numbered bonuses still follow the numbered winner.
 const usable=creature?bonuses.filter(b=>!['Pirate captures Mermaid','Skull King captures Pirate','Mermaid captures Skull King','First Mate captured','Loot alliance'].includes(b.label)):bonuses;
 m.bonusEvents.push(...usable);if(winner)m.won[winner.playerId]++;
 const reason=creature?.card.type==='kraken'?'Kraken destroys this trick; nobody wins.':creature?winner?`${winner.card.name} is the ${creature.card.type==='whale'?'highest':'lowest'} number; ${creature.card.name} ignores suits.`:'No numbered card survives the sea creature; nobody wins.':winner&&['escape','loot'].includes(winner.card.type)?'The first Escape wins because the other remaining cards cannot win.':winner?`${winner.card.name} wins this trick.`:'No remaining card can win this trick.';
 m.result={winnerId:winner?.playerId||null,winningCardId:winner?.card.id||null,removedIds:[...m.removed],bonuses:usable,reason};m.leader=winner?.playerId||nextLeader;
 m.powers=winner&&(!creature)?(winner.card.type==='first-mate'?remaining.filter(p=>pirate(p)&&p.card.power).map(p=>p.card):winner.card.power?[winner.card]:[]):[];
 m.powerOwner=winner?.playerId;nextPower(m);
}
function nextPower(m){
 m.decision=null;const c=m.powers.shift();if(!c){m.turn=null;if(m.round===10&&m.trick===m.dealt){endRound(m);return;}m.phase='trick';return;}
 const power=c.power,owner=m.powerOwner,final=m.trick===m.dealt;
 if(final&&power!=='bid'||power==='force'&&m.round===10)return nextPower(m);
 const opts=[option('decline','Do not use this power')];
 if(power==='lead'||power==='force')opts.unshift(...m.players.filter(id=>m.hands[id].length||power==='lead').map(id=>option(id,id)));
 if(power==='bid')for(const change of [-1,0,1]){const bid=m.bids[owner]+change;if(bid>=0&&bid<=m.dealt)opts.unshift(option(String(change),`Bid ${bid}`));}
 if(power==='wager')opts.unshift(option('10','Wager 10'),option('20','Wager 20'));
 if(power==='exchange'&&m.reserve.length<2)return nextPower(m);
 if(['exchange','peek'].includes(power))opts.unshift(option('use',power==='exchange'?'Draw two cards':'Inspect undealt cards'));
 decision(m,owner,`power:${power}`,`${c.name}: choose your power`,opts);
}
function choose(m,id,value){
 const d=m.decision;if(!d||d.playerId!==id)throw Error('Wait for your choice.');
 if(!d.options.some(o=>String(o.value)===String(value)))throw Error('Choose an available option.');
 if(d.kind==='plank'){m.removed.push(value);m.decision=null;return finishPlays(m);}
 if(d.kind==='mary-card'){m.forced[d.targetId]=value;return nextPower(m);}
 if(d.kind==='discard'){m.hands[id]=m.hands[id].filter(c=>c.id!==value);m.reserve.push(d.options.find(o=>o.value===value).card);if(d.remaining>1)return discard(m,id,d.remaining-1);return nextPower(m);}
 if(d.kind==='peek'){return nextPower(m);}
 const power=d.kind.slice(6);if(value==='decline')return nextPower(m);
 if(power==='lead')m.leader=value;
 if(power==='bid')m.bids[id]+=Number(value);
 if(power==='wager')m.wagers[id]+=Number(value);
 if(power==='force')return decision(m,id,'mary-card',`Choose the card ${value} must play next trick`,m.hands[value].map(c=>option(c.id,c.name,c)),{targetId:value});
 if(power==='exchange'){m.hands[id].push(...m.reserve.splice(0,2));return discard(m,id,2);}
 if(power==='peek')return decision(m,id,'peek','Undealt cards — only you can see these', [option('done','Continue')],{cards:m.reserve});
 nextPower(m);
}
function discard(m,id,remaining){decision(m,id,'discard',`Discard ${remaining} card${remaining===1?'':'s'}`,m.hands[id].map(c=>option(c.id,c.name,c)),{remaining});}
function endRound(m){const exact=Object.fromEntries(m.players.map(id=>[id,m.bids[id]===m.won[id]]));const bonuses=awardedBonuses(m.bonusEvents,exact);const results=m.players.map(id=>{const s=scoreRound({bid:m.bids[id],won:m.won[id],dealt:m.dealt,bonuses:bonuses.filter(b=>b.playerId===id),wager:m.wagers[id]});m.scores[id]+=s.total;return {id,bid:m.bids[id],won:m.won[id],...s,score:m.scores[id]};});m.history.push({round:m.round,results});m.result={round:m.round,results};m.phase=m.round===10?'finished':'round';}
export function act(m,id,a){
 if(!m.players.includes(id))throw Error('Not seated.');
 if(a.type==='bid'){if(m.phase!=='bidding'||Object.hasOwn(m.bids,id)||!Number.isInteger(a.bid)||a.bid<0||a.bid>m.dealt)throw Error('Choose a valid unlocked bid.');m.bids[id]=a.bid;if(m.players.every(p=>Object.hasOwn(m.bids,p)))startTrick(m);}
 else if(a.type==='play'){
  const c=m.hands[id]?.find(c=>c.id===a.cardId);let choice=a.choice;
  if(c?.suit==='wild'&&leadSuit(m.plays)&&leadSuit(m.plays)!=='black')choice=leadSuit(m.plays);
  const error=playError(m,id,a.cardId,choice);if(error)throw Error(error);
  m.hands[id]=m.hands[id].filter(c=>c.id!==a.cardId);delete m.forced[id];m.plays.push({playerId:id,card:c,choice});
  if(m.extra){m.extra=false;finishPlays(m);}else{m.index++;if(m.index<m.order.length)m.turn=m.order[m.index];else finishPlays(m);}
 }
 else if(a.type==='choose')choose(m,id,a.value??a.choice);
 else if(a.type==='continue'){if(m.phase==='trick'){if(m.trick>=m.dealt)endRound(m);else{m.trick++;startTrick(m);}}else if(m.phase==='round')startRound(m);else throw Error('Nothing to continue.');}
 else throw Error('Unknown action.');m.revision++;return m;
}
function leadingPlayer(m){
 let remaining=m.plays.filter(p=>!(m.removed||[]).includes(p.card.id));
 if(remaining.some(p=>p.card.type==='locker'))remaining=remaining.filter(p=>!seas.includes(p.card.type));
 const creature=remaining.filter(p=>seas.includes(p.card.type)).at(-1);
 if(creature?.card.type==='kraken')return null;
 if(creature)return remaining.filter(p=>p.card.type==='number').reduce((best,p)=>!best||(creature.card.type==='whale'?rank(p)>rank(best):rank(p)<rank(best))?p:best,null)?.playerId||null;
 return normalWinner(remaining,leadSuit(m.plays))?.playerId||null;
}
export function snapshot(m,viewerId){const own=m.players.includes(viewerId),revealed=m.phase!=='bidding';let d=null;if(m.decision){const {options,cards,...rest}=m.decision;d={...rest,...(m.decision.playerId===viewerId?{options,...(cards?{cards}: {})}:{options:[]})};}return {phase:m.phase,round:m.round,dealt:m.dealt,trick:m.trick,turn:m.turn,leader:m.leader,leadingPlayerId:leadingPlayer(m),expansion:m.expansion,players:m.players.map(id=>({id,bid:revealed||id===viewerId?m.bids[id]??null:null,bidLocked:Object.hasOwn(m.bids,id),won:m.won[id],score:m.scores[id],cards:m.hands[id].length})),hand:own?m.hands[viewerId]:[],legalPlays:own&&m.phase==='play'&&m.turn===viewerId?m.hands[viewerId].flatMap(card=>(card.choices||(card.suit==='wild'?['yellow','purple','green']:[undefined])).filter(choice=>!playError(m,viewerId,card.id,choice)).map(choice=>({cardId:card.id,choice}))):[],plays:m.plays,decision:d,result:m.result,history:m.history,forcedCardId:own?m.forced[viewerId]??null:null,revision:m.revision};}
export function botAction(m,id){
 if(m.phase==='bidding'&&!Object.hasOwn(m.bids,id))return {type:'bid',bid:bidForHand(m.hands[id])};
 if(m.phase==='decision'&&m.decision.playerId===id){const d=m.decision;let o=d.options.find(o=>o.value!=='decline')||d.options[0];if(d.kind==='power:bid')o=d.options.reduce((best,p)=>p.value==='decline'?best:!best||Math.abs(m.bids[id]+Number(p.value)-m.won[id])<Math.abs(m.bids[id]+Number(best.value)-m.won[id])?p:best,null);return {type:'choose',value:o.value};}
 if(m.phase==='play'&&m.turn===id){const chosen=chooseBotPlay({hand:m.hands[id],plays:m.plays,bid:m.bids[id],won:m.won[id],playersAfter:m.extra?0:Math.max(0,m.order.length-m.index-1),forcedCardId:m.forced[id]});return {type:'play',cardId:chosen.cardId,choice:chosen.choice};}
 if(['trick','round'].includes(m.phase))return {type:'continue'};return null;
}
