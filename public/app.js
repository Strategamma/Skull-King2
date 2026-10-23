import { TurnAlerts } from './turn-alerts.js';
import { chooseBotPlay,bidForHand } from './bot.js';
import { mountAbilityScreens } from './ability-screens.js';
import { PirateAudio } from './audio.js';
import { SPECIALS, makeDeck, numberCard, SUITS } from './cards.js';
import { commitPlay, playError, scoreRound } from './rules.js';
import { tableLayout } from './table-layout.js';
import { createBidding,lockBid,waitingFor,visibleBids } from './bidding.js';
const $ = (id) => document.getElementById(id);
const audio = new PirateAudio();
const modal = $('modal');
const content = $('modal-content');
const safeRead = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const params = new URLSearchParams(location.hash.slice(1));
const hint = params.get('arcadeName')?.trim();
$('name').value = safeRead('skull-name') || (hint && hint.length <= 32 ? hint : '');
if (params.has('arcadeName')) {
  params.delete('arcadeName');
  history.replaceState(null, '', location.pathname + location.search + (params.size ? `#${params}` : ''));
}
$('name').addEventListener('change', () => safeWrite('skull-name', $('name').value.trim()));
let soundBusy = false;
$('sound').onclick = async () => {
  if (soundBusy) return;
  soundBusy = true;
  try {
    const enabled = await audio.toggle();
    $('sound').setAttribute('aria-pressed', String(enabled));
    $('sound').setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
    $('sound').querySelector('span').textContent = enabled ? 'ON' : 'OFF';
    $('game-sounds').checked=enabled;
    safeWrite('skull-sound', String(enabled));
  } catch { $('sound').setAttribute('aria-label', 'Sound unavailable in this browser'); }
  finally { soundBusy = false; }
};
// Restore sound only following a gesture, respecting browser autoplay requirements.
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('#sound') && safeRead('skull-sound') === 'true' && !audio.enabled) $('sound').click();
}, { once: true });
document.addEventListener('visibilitychange', async () => { try {await audio.syncVisibility();} catch {} turnAlerts.flush(); });
document.addEventListener('pointerdown',()=>audio.unlock().catch(()=>{}),{once:true});
document.addEventListener('click', (event) => { if (event.target.closest('button')) audio.play(); });
const open = (html) => {
  content.innerHTML = html;
  const heading=content.querySelector('h2');
  if(heading){heading.id='dialog-title';modal.setAttribute('aria-labelledby',heading.id);}
  else modal.removeAttribute('aria-labelledby');
  modal.scrollTop=0;
  if (!modal.open) modal.showModal();
  audio.play('creak');
};
modal.querySelector('.close').onclick = () => modal.close();
modal.addEventListener('click', (e) => { if (e.target === modal) { const r = modal.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) modal.close(); } });
const learn = () => open(`<h2>How to play</h2><ol><li><b>Read your hand.</b> Predict exactly how many tricks you will win. Everyone locks a private bid; all bids reveal together.</li><li><b>Play in turn.</b> Follow the leading suit when playing a numbered card, if you can. Special cards can change the outcome.</li><li><b>Watch the table.</b> Black is trump. Pirates beat numbers; the Skull King beats pirates; a Mermaid can defeat the King.</li><li><b>Hit your bid.</b> Exact predictions earn points. Too many or too few tricks cost points. The highest total after ten rounds wins.</li></ol><p>Tap a pirate card to see its ability above your hand. Swipe upward to play when it is legal and your turn.</p><p class="disclaimer">The complete game now runs from the game/ package. Open the live game at localhost:3001 for private tables, every card power and real scoring.</p>`);
$('learn').onclick = learn; $('guide').onclick = learn;
$('create').onclick = () => {
  $('opening').hidden = true; $('setup-screen').hidden = false;
  $('setup-back').focus(); audio.play('creak');
};
$('setup-back').onclick = () => { $('setup-screen').hidden = true; $('opening').hidden = false; $('create').focus(); };
$('view-table').onclick = showTable;
document.querySelectorAll('input[name="mode"]').forEach((input) => input.onchange = () => {
  $('mode-description').textContent = input.value === 'base' ? 'The classic 70-card deck with named pirate powers.' : 'Adds sea creatures, Loot, First Mate Con and the full expansion pack.';
});
$('join').onclick = () => {
  open(`<h2>Find your crew</h2><label for="room-code">FIVE-LETTER TABLE CODE</label><input id="room-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="OCEAN"><p class="disclaimer">Preview only. Joining will be enabled when the private-room service is connected.</p>`);
  $('room-code').oninput = () => { $('room-code').value = $('room-code').value.replace(/[^a-z]/gi, '').toUpperCase(); };
};
const seats = [
  ['Sam',1,3,'Black 12','LEADING'],['Maya',0,2,'Purple 8',''],['Alex',0,0,'Escape',''],['Robin',1,2,'Yellow 7',''],['Lee',0,1,'Green 4',''],['Captain',1,2,'Your turn','YOU'],['Jordan',0,1,'Not played',''],['Casey',1,3,'Not played','BOT'],['Ari',0,1,'Not played',''],['Morgan',0,0,'Escape',''],
];
const hand = [SPECIALS[0],SPECIALS.find(c=>c.id==='first-mate'),numberCard('black',9),numberCard('yellow',14),SPECIALS.find(c=>c.id==='escape')];
const handPool=[...hand,numberCard('green',6),SPECIALS.find(c=>c.id==='mermaid'),SPECIALS.find(c=>c.id==='rosie'),numberCard('purple',8),numberCard('yellow',6),numberCard('black',6)];
const cardTheme=card=>['pirate','skull-king','first-mate','tigress'].includes(card.type)?' theme-pirate':card.type==='mermaid'?' theme-mermaid':'';
let tableState;
let turnRevision=0;
const defaultTitle=document.title;
$('turn-chime').checked=safeRead('skull-turn-chime')!=='false';
$('turn-vibration').checked=safeRead('skull-turn-vibration')!=='false';
$('turn-vibration').disabled=typeof navigator.vibrate!=='function';
$('game-sounds').onchange=()=>{$('sound').click();};
audio.alertsEnabled=$('turn-chime').checked;
$('haptic-support').textContent=typeof navigator.vibrate==='function'?'Vibration depends on your phone and browser.':'This browser does not support vibration. Turn chimes still work.';
function localTurnFeedback() {
  audio.play('turn');
  if($('turn-vibration').checked&&typeof navigator.vibrate==='function') {try {navigator.vibrate([90,65,130]);} catch {}}
}
const turnAlerts=new TurnAlerts({localId:'Captain',isVisible:()=>!document.hidden&&!$('table-screen').hidden,onAlert:localTurnFeedback});
for(const id of ['turn-chime','turn-vibration']) $(id).onchange=()=>{
  safeWrite(id==='turn-chime'?'skull-turn-chime':'skull-turn-vibration',String($(id).checked));
  audio.alertsEnabled=$('turn-chime').checked;
  if(id==='turn-vibration'&&!$(id).checked) {try {navigator.vibrate?.(0);} catch {}}
  audio.syncVisibility().catch(()=>{});
};
function highlightTurn(playerId) {
  document.querySelectorAll('#table .seat').forEach(seat=>{
    const active=seat.dataset.player===playerId;seat.classList.toggle('active-turn',active);
    if(active)seat.setAttribute('aria-current','true');else seat.removeAttribute('aria-current');
    seat.querySelector('.turn-indicator')?.remove();
    const waiting=seat.querySelector('.waiting-card');if(waiting&&seat.dataset.player==='Captain')waiting.textContent=active?'Your turn':'Waiting';
    if(active){const label=document.createElement('span');label.className='turn-indicator';label.textContent=playerId==='Captain'?'YOUR TURN':'PLAYING';seat.querySelector('.avatar').append(label);}
  });
  document.title=playerId==='Captain'?'Your turn! · Skull King':defaultTitle;
}
function announceTurn() {
  highlightTurn(tableState.phase==='play'?tableState.turn:null);
  turnAlerts.update({phase:tableState.phase,turn:tableState.turn,key:++turnRevision});
}
$('test-turn-alert').onclick=async()=>{try {await audio.unlock();} catch {}localTurnFeedback();};
$('preview-next-turn').onclick=()=>{
  if(tableState?.phase!=='play'){showTable({expansion:previewExpansion});return;}
  const players=[...document.querySelectorAll('#table .seat')].map(s=>s.dataset.player);
  tableState.turn=players[(players.indexOf(tableState.turn)+1)%players.length];
  document.querySelector('.turn-banner strong').textContent=tableState.turn==='Captain'?'Your turn, Captain':`${tableState.turn}’s turn`;
  document.querySelector('.turn-banner span').textContent='Turn-change preview · no automatic plays';
  document.querySelectorAll('#hand .card').forEach(b=>{const error=playError(tableState,'Captain',b.dataset.cardId);b.classList.toggle('illegal',!!error);b.dataset.legal=String(!error);b.dataset.blockedLabel=error?(tableState.turn==='Captain'?'FOLLOW SUIT':'WAIT TURN'):'';});
  $('ability').hidden=true;announceTurn();
};

let previewExpansion=true;
function cardFace(card) {
  const marked = ['6','9'].includes(String(card.rank)) ? ' marked-rank' : '';
  return `<span class="rank${marked}">${card.rank}</span>${card.art ? `<img class="portrait" src="/assets/${card.art}" alt="">` : `<span class="symbol" aria-hidden="true">${card.symbol}</span>`}<span class="rank reverse${marked}" aria-hidden="true">${card.rank}</span>${card.bonus ? `<span class="bonus">${card.bonus>0?'+':''}${card.bonus} bonus*</span>` : ''}<span class="card-name">${card.name}</span>`;
}
function playedCard(name) {
  if (name === 'Escape') return hand[4];
  const [suit,rank] = name.split(' ');
  return numberCard(suit.toLowerCase(),Number(rank));
}
function showTable(options = {}) {
  if(typeof options.expansion==='boolean') previewExpansion=options.expansion;
  else if(options instanceof Event && options.currentTarget?.id==='view-table') previewExpansion=document.querySelector('input[name="mode"]:checked').value==='expansion';
  const count=Number($('preview-players').value);
  const lead=$('preview-lead').value;
  const activeSeats=count===10?seats:[...seats.filter(s=>s[0]!=='Captain').slice(0,count-1),seats.find(s=>s[0]==='Captain')];
  const layout=tableLayout(activeSeats.map(s=>({id:s[0]})),'Captain');
  $('table').style.setProperty('--play-columns',layout.columns);
  $('table').dataset.players=count;
  $('opening').hidden = true; $('setup-screen').hidden = true; $('table-screen').hidden = false;
  $('ability').hidden = true;
  document.querySelector('.table-heading h2').innerHTML='Round 6 <small>/ 10</small>';
  document.querySelector('.turn-banner strong').textContent='Your turn, Captain';
  const localIndex=activeSeats.findIndex(s=>s[0]==='Captain');
  document.querySelector('.turn-banner span').textContent=`${activeSeats.length-localIndex-1} players after you · Sam leads ${lead}`;
  $('table-note').textContent=`Follow ${lead} or play a special. Tap any card for its power; swipe up to play.`;
  $('table').classList.remove('dealing');
  $('table').replaceChildren();
  const publicTrick=document.createElement('div'); publicTrick.id='public-trick'; publicTrick.setAttribute('aria-label','Cards played in this trick');
  $('table').append(publicTrick);
  activeSeats.forEach(([name,won,bid,played,badge],index) => {
    const seat = document.createElement('div'); seat.className = 'seat' + (badge === 'LEADING' ? ' leading' : '');
    seat.dataset.player = name; seat.style.setProperty('--seat-index',index);
    seat.dataset.edge=layout.seats[index].edge||'cap';
    seat.style.setProperty('--seat-x',`${layout.seats[index].x}%`);seat.style.setProperty('--seat-y',`${layout.seats[index].y}%`);
    const avatar = document.createElement('span'); avatar.className = 'avatar';
    const portrait=document.createElement('img');portrait.alt='';portrait.src=`/assets/${['rosie.jpg','bendt.jpg','rascal.jpg','juanita.jpg','harry.jpg','tigress.jpg','first-mate.png','mary.jpg','mermaid.jpg','skull-king.png'][index]}`;avatar.append(portrait);
    const info = document.createElement('div'); const title = document.createElement('strong'); title.textContent = name;
    const progress = document.createElement('span'); progress.className = 'progress'; progress.textContent = `${won} won / ${bid} bid`;
    info.append(title,progress);
    if (badge) { const label = document.createElement('span'); label.className = 'badge'; label.textContent = ` · ${badge}`; info.append(label); }
    const play = document.createElement('div'); play.className = 'played';play.dataset.player=name;
    play.style.setProperty('--play-x',`${layout.seats[index].playX}%`);play.style.setProperty('--play-y',`${layout.seats[index].playY}%`);
    if (played === 'Not played' || played === 'Your turn') { const waiting = document.createElement('span'); waiting.className='waiting-card'; waiting.textContent = played; play.append(waiting); }
    else { play.append(publicCard(name==='Sam'?numberCard(lead,12):playedCard(played),name)); }
    seat.append(avatar,info,play); $('table').append(seat);
  });
  $('hand').replaceChildren();
  const expansion = previewExpansion;
  const currentHand=handPool.filter((card) => expansion || !card.expansion).slice(0,Number($('preview-hand').value));
  $('hand').dataset.count=currentHand.length;
  tableState={phase:'play',turn:'Captain',hands:{Captain:[...currentHand]},plays:[{playerId:'Sam',card:numberCard(lead,12)}]};
  currentHand.forEach((card) => {
    const holder=document.createElement('div');holder.className='hand-card';
    const button = document.createElement('button'); button.className = `card suit-${card.kind}${cardTheme(card)}`;
    button.setAttribute('aria-label', `Inspect ${card.name}`);
    button.dataset.cardId=card.id;
    const invalid=playError(tableState,'Captain',card.id);
    button.classList.toggle('illegal',!!invalid);button.dataset.legal=String(!invalid);
    button.dataset.blockedLabel=invalid?'FOLLOW SUIT':'';
    button.innerHTML = cardFace(card);
    let swiped = false;
    const inspect = () => {
      const invalid=playError(tableState,'Captain',card.id);
      document.querySelectorAll('.card').forEach((b) => b.classList.toggle('selected', b === button));
      $('ability').hidden = false; $('ability').replaceChildren();
      const title = document.createElement('strong'); title.textContent = card.name;
      const text = document.createElement('span'); text.textContent = card.ability;
      const close = document.createElement('button'); close.className='ability-close'; close.textContent='×'; close.setAttribute('aria-label','Close card details'); close.onclick=()=>{$('ability').hidden=true;button.focus();};
      const play = document.createElement('button'); play.className = 'demo-play'; play.textContent = invalid || 'Play card · or swipe up ↑';play.disabled=!!invalid; play.onclick = () => demoPlay(button,card);
      $('ability').append(close,title,text,document.createElement('br'),play);
    };
    button.onclick=()=>{if(swiped){swiped=false;return;}inspect();};
    let start = null;
    button.onpointerdown = (e) => { if (e.isPrimary) { swiped=false; start = { x:e.clientX,y:e.clientY }; button.setPointerCapture(e.pointerId); } };
    button.onpointerup = (e) => { if (start && start.y-e.clientY>40 && Math.abs(start.x-e.clientX)<65) { swiped=true; demoPlay(button,card); } start=null; };
    button.onpointercancel = () => { start=null; };
    holder.append(button);$('hand').append(holder);
  });
  void $('table').offsetWidth; $('table').classList.add('dealing');
  const bidding=$('preview-phase').value==='bid';
  $('bidding-view').hidden=!bidding;$('table').hidden=bidding;
  if(bidding) startBidding(activeSeats.map(s=>s[0]),currentHand.length);
  announceTurn();audio.play('deal');
}
function demoPlay(button,card) {
  const result=commitPlay(tableState,'Captain',card.id);
  if(!result.ok){$('table-note').textContent=result.error;audio.play('error');return;}
  tableState=result.state;
  $('ability').hidden=true;
  audio.play('swish'); button.classList.remove('playing'); void button.offsetWidth; button.classList.add('playing');
  const target = $('table').querySelector('.played[data-player="Captain"]');
  target.replaceChildren();
  const visible = publicCard(card,'Captain'); visible.classList.add('arriving');target.append(visible);
  button.closest('.hand-card').remove();
  ($('hand').querySelector('button')||$('home')).focus({preventScroll:true});
  $('hand').dataset.count=tableState.hands.Captain.length;
  $('table-note').textContent = `${card.name} played. Review preview: reopen the table to try another card.`;
  const players=[...document.querySelectorAll('#table .seat')].map(s=>s.dataset.player),next=players[(players.indexOf('Captain')+1)%players.length];
  highlightTurn(next);turnAlerts.update({phase:'review',turn:null,key:++turnRevision});
  document.querySelector('.turn-banner strong').textContent=`${next}’s turn`;
  document.querySelector('.turn-banner span').textContent='Preview paused · waiting for the next player';
  document.querySelectorAll('#hand .card').forEach(b=>{b.classList.add('illegal');b.dataset.legal='false';b.dataset.blockedLabel='WAIT TURN';});
}
$('preview').onclick = () => showTable({expansion:true});
$('preview-players').onchange=()=>showTable({expansion:previewExpansion});
$('preview-hand').onchange=()=>showTable({expansion:previewExpansion});
$('preview-lead').onchange=()=>showTable({expansion:previewExpansion});
$('preview-phase').onchange=()=>{showTable({expansion:previewExpansion});$('preview-controls').hidden=true;$('preview-settings').setAttribute('aria-expanded','false');};
$('preview-settings').onclick=()=>{const panel=$('preview-controls');panel.hidden=!panel.hidden;$('preview-settings').setAttribute('aria-expanded',String(!panel.hidden));};
function publicCard(card,owner) {
  const button=document.createElement('button');button.className=`mini-card suit-${card.kind}${cardTheme(card)}`;button.setAttribute('aria-label',`${owner} played ${card.name}`);button.innerHTML=cardFace(card);
  button.onclick=()=>{open(`<h2 id="played-owner"></h2><div class="enlarged-card card suit-${card.kind}${cardTheme(card)}">${cardFace(card)}</div><p id="played-ability"></p>`);$('played-owner').textContent=`${owner} played`;$('played-ability').textContent=card.ability;};
  return button;
}
$('home').onclick = () => { turnAlerts.clear();document.title=defaultTitle;try {navigator.vibrate?.(0);}catch {} $('preview-controls').hidden=true;$('preview-settings').setAttribute('aria-expanded','false'); $('table-screen').hidden = true; $('opening').hidden = false; $('preview').focus(); };
const ledger = [
  ['Sam',2,2,130,[{label:'Black 14',points:20}]],['Casey · BOT',1,1,100,[{label:'Purple 14',points:10}]],
  ['Robin',1,1,80,[{label:'Pirate captures Mermaid',points:20}]],['Maya',2,0,120,[{label:'Unawarded 14',points:10}]],
  ['Lee',1,0,70,[]],['Captain',1,1,60,[{label:'Yellow 14',points:10}]],
  ['Ari',0,0,0,[]],['Jordan',1,0,70,[]],['Morgan',0,0,-30,[]],['Alex',0,1,80,[]],
].map(([name,bid,won,previous,bonuses])=>({name,bid,won,previous,bonuses,...scoreRound({bid,won,dealt:6,bonuses})})).sort((a,b)=>(b.previous+b.total)-(a.previous+a.total));
function showStandings(scored=true) {
  const rows=[...ledger].sort((a,b)=>(b.previous+(scored?b.total:0))-(a.previous+(scored?a.total:0)));
  open(`<h2>The captain's ledger</h2><p class="disclaimer">Sample ${scored?'round 6 results':'standings before round 6'} · local preview</p><div class="podium">${rows.slice(0,3).map((r,i)=>`<div class="podium-place place-${i+1}"><span>${i===0?'♛':i===1?'♕':'✦'}</span><strong>${r.name}</strong><b>${r.previous+(scored?r.total:0)}</b><small>POINTS</small></div>`).join('')}</div><div class="standing-switch"><button id="before-score" aria-pressed="${!scored}">Before round</button><button id="after-score" aria-pressed="${scored}">Round scored</button></div><div class="ledger-scroll"><table class="ledger"><thead><tr><th>Player</th><th>Won / Bid</th><th>Bid pts</th><th>Bonus</th><th>Round</th><th>Total</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><th>${i===0?'♛ ':i===1?'♕ ':''}${r.name}</th><td>${scored?`${r.won} / ${r.bid}`:'—'}</td><td>${scored?r.bidPoints:'—'}</td><td class="bonus-cell">${scored?(r.bonus>0?'+':'')+r.bonus:'—'}</td><td>${scored?r.total:'—'}</td><td>${r.previous+(scored?r.total:0)}</td></tr>`).join('')}</tbody></table></div><p class="ledger-explanation">Bonuses count only with an exact bid.</p><details><summary>Bonus breakdown</summary>${ledger.filter(r=>r.bonuses.length).map(r=>`<p><b>${r.name}:</b> ${r.bonuses.map(b=>`${b.label} (${b.points>0?'+':''}${b.points})`).join(', ')}${r.exact?'':' — not awarded: missed bid'}</p>`).join('')}</details>`);
  $('before-score').onclick=()=>showStandings(false);$('after-score').onclick=()=>showStandings(true);
}
$('scores').onclick=()=>{showStandings();audio.play('coins');};
let bidState,chosenBid=null;
function startBidding(players,dealt) {
  bidState=createBidding(players,dealt);chosenBid=null;
  const others=players.filter(p=>p!=='Captain');
  others.slice(0,Math.max(0,others.length-3)).forEach((id,i)=>{bidState=lockBid(bidState,id,i%(dealt+1));});
  tableState={...tableState,phase:'bidding',turn:null,plays:[]};
  document.querySelectorAll('#hand .card').forEach(b=>{b.classList.remove('illegal');b.dataset.legal='false';});
  document.querySelector('.table-heading h2').innerHTML=`Round ${dealt} <small>/ 10</small>`;
  document.querySelector('.turn-banner strong').textContent='Make your prediction';
  document.querySelector('.turn-banner span').textContent='Study your hand. All bids reveal together.';
  $('table-note').textContent='Tap any card to read its power. Bids stay secret until everyone locks.';
  renderBidding();
}
function renderBidding() {
  const pending=waitingFor(bidState),mine=Object.hasOwn(bidState.bids,'Captain'),revealed=pending.length===0;
  const visible=visibleBids(bidState,'Captain');
  $('bidding-view').innerHTML=`<div class="bid-heading"><span class="eyebrow">${revealed?'YO · HO · HO!':mine?'PREDICTION SEALED':'TRUST YOUR HAND'}</span><h2>${revealed?'Bids revealed':mine?`You bid ${bidState.bids.Captain}`:'How many tricks?'}</h2><p>${revealed?'Every prediction is now on the table.':mine?`Waiting for ${pending.length} ${pending.length===1?'player':'players'}`:`Choose 0–${bidState.dealt}. Match your bid exactly to score.`}</p></div>${!mine?`<div class="bid-choices" role="group" aria-label="Choose your bid">${Array.from({length:bidState.dealt+1},(_,i)=>`<button data-bid="${i}" aria-pressed="${chosenBid===i}">${i}</button>`).join('')}</div><button class="primary" id="lock-bid" ${chosenBid===null?'disabled':''}>LOCK ${chosenBid===null?'YOUR':chosenBid} BID ⚓</button>`:`<div class="sealed-bid"><span>${revealed?'✦':'⚓'}</span><b>${bidState.bids.Captain}</b><small>YOUR BID</small></div>`}<div class="bid-crew" aria-label="Player bidding status">${visible.map(p=>`<div><span>${p.id}</span><b>${revealed?p.bid:p.id==='Captain'&&mine?`You: ${p.bid}`:p.locked?'✓ Locked':'Choosing…'}</b></div>`).join('')}</div>${mine&&!revealed?'<button class="text-button" id="advance-bid">Preview: next player locks →</button>':''}${revealed?'<button class="primary" id="begin-play">BACK TO PLAYING PREVIEW →</button>':''}`;
  $('bidding-view').querySelectorAll('[data-bid]').forEach(b=>b.onclick=()=>{chosenBid=Number(b.dataset.bid);audio.play();renderBidding();$('bidding-view').querySelector(`[data-bid="${chosenBid}"]`).focus({preventScroll:true});});
  if($('lock-bid')) $('lock-bid').onclick=()=>{bidState=lockBid(bidState,'Captain',chosenBid);audio.play('bell');renderBidding();($('advance-bid')||$('begin-play')).focus({preventScroll:true});};
  if($('advance-bid')) $('advance-bid').onclick=()=>{const id=waitingFor(bidState)[0];bidState=lockBid(bidState,id,bidState.players.indexOf(id)%(bidState.dealt+1));renderBidding();if(!waitingFor(bidState).length)audio.play('reveal');($('advance-bid')||$('begin-play')).focus({preventScroll:true});};
  if($('begin-play')) $('begin-play').onclick=()=>{$('preview-phase').value='play';showTable({expansion:previewExpansion});};
}
function showCardGuide() {
  const examples=Object.keys(SUITS).map(s=>numberCard(s,14));
  const zero=makeDeck({expansion:true}).find(c=>c.id==='yellow-0-14');
  const cards=[...SPECIALS,...examples,zero,...makeDeck({expansion:true}).filter(c=>c.id==='yellow-7-extra'||c.id==='yellow-8-extra')];
  open(`<h2>Know your deck</h2><p>Tap any card for its power, timing and bonuses. Base: 70 cards. Full expansion: 93 cards before two-player exclusions.</p><div class="card-catalog">${cards.map((c,i)=>`<button class="guide-card card suit-${c.kind}${cardTheme(c)}" data-guide="${i}" aria-label="Explain ${c.name}">${cardFace(c)}</button>`).join('')}</div><div id="guide-detail" aria-live="polite"></div>`);
  content.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>{
    const card=cards[Number(b.dataset.guide)],detail=$('guide-detail');
    detail.replaceChildren();const title=document.createElement('h3');title.textContent=card.name;const text=document.createElement('p');text.textContent=card.ability;detail.append(title,text);detail.scrollIntoView({block:'nearest'});
  });
}
const abilityScreens=mountAbilityScreens({open,content,learn,onResolve:()=>audio.play('power')});
$('guide').onclick=abilityScreens.gallery;
$('ability-gallery').onclick=abilityScreens.gallery;
window.render_game_to_text=()=>JSON.stringify({screen:!$('table-screen').hidden?'table':!$('setup-screen').hidden?'setup':'opening',phase:tableState?.phase,turn:tableState?.turn,hand:tableState?.hands.Captain.map(c=>({id:c.id,legal:!playError(tableState,'Captain',c.id)})),plays:tableState?.plays.map(p=>({player:p.playerId,card:p.card.name})),coordinates:'DOM layout; origin top left, x right, y down'});

// Keep installation user-initiated and confined to settings.
let installPrompt = null;
const standalone = matchMedia('(display-mode: standalone)');
const installButton = $('install-app');
const installStatus = $('install-status');
function updateInstallState() {
  const installed = standalone.matches || navigator.standalone === true;
  installButton.disabled = installed;
  installButton.textContent = installed ? 'App installed' : 'Install app';
  if (installed) installStatus.textContent = 'You’re playing in the app.';
}
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installStatus.textContent = '';
  updateInstallState();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.disabled = true;
  installButton.textContent = 'App installed';
  installStatus.textContent = 'Skull King is installed. Find it with your apps.';
});
standalone.addEventListener('change', updateInstallState);
installButton.onclick = async () => {
  if (!installPrompt) {
    const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    installStatus.textContent = appleMobile
      ? 'In Safari, open Share, then Add to Home Screen.'
      : 'Open your browser menu and choose Install app or Add to Home Screen, if available. If this browser has no install option, try Chrome, Edge or Safari.';
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  installButton.disabled = true;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installStatus.textContent = choice.outcome === 'accepted'
      ? 'Installation requested. Follow your browser to finish.'
      : 'Installation cancelled. You can keep playing here.';
  } catch {
    installStatus.textContent = 'Could not open installation. Try the install option in your browser menu.';
  } finally { installButton.disabled = false; updateInstallState(); }
};
updateInstallState();

function showBotPreview(avoid=false) {
  const botHand=[numberCard('black',9),numberCard('black',13),numberCard('yellow',6),SPECIALS.find(c=>c.id==='escape')];
  const plays=[{playerId:'Sam',card:numberCard('black',8)}];
  const decision=chooseBotPlay({hand:botHand,plays,bid:avoid?1:2,won:1,playersAfter:0});
  const card=botHand.find(c=>c.id===decision.cardId);
  open(`<h2>The bot’s next move</h2><p class="disclaimer">Strategy preview · last player to act · Sam leads Black 8</p><div class="standing-switch"><button id="bot-needs" aria-pressed="${!avoid}">Needs one trick</button><button id="bot-avoid" aria-pressed="${avoid}">Bid already met</button></div><p>Hand: Black 9, Black 13, Yellow 6, Escape.</p><div class="bot-choice"><span class="eyebrow">${avoid?'PROTECT THE BID':'TAKE THE TRICK'}</span><h3>${card.name}</h3><p>${decision.reason}</p></div><p>Estimated bid for this hand: ${bidForHand(botHand)}. Off-suit Yellow 6 is excluded. No opponent hands are used.</p><p class="disclaimer">Heuristic policy, not a trained AI. Complex creature/Volley strategy remains provisional until their full resolver exists.</p>`);
  $('bot-needs').onclick=()=>showBotPreview(false);$('bot-avoid').onclick=()=>showBotPreview(true);
}
$('bot-preview').onclick=()=>showBotPreview();
