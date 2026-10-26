import {FeedbackTracker,outcomeText} from './feedback.js';
import {victoryMarkup} from './victory.js';
import {SPECIALS,numberCard,SUITS} from './cards.js';
import {PirateAudio} from './audio.js';
import {tableLayout} from './table-layout.js';
import {playError} from './rules.js';
import {TurnAlerts} from './turn-alerts.js';
import {websocketUrl} from './config.js';
const $=id=>document.getElementById(id),modal=$('modal'),content=$('modal-content'),audio=new PirateAudio();
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}},write=(key,value)=>{try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value);}catch{}};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const feedbackTracker=new FeedbackTracker(),activeEffects=new Map();
let effectAnimations=[],effectTimer=null,celebrate=false,connectionStarted=0,lifecycleTimer=null;
let session;try{session=JSON.parse(read('skull-session'));}catch{}
let inFlight=null,actionTimer=null,requestSequence=0,lastFocusPhase='',lastAnnouncement='',actionError='',connectionReady=false,pendingFocus=null,leaving=false;
let room=null,socket=null,retryTimer=null,retry=0,pending=null,selected=null,lastEvent='',bidChoice=null,choiceSelection=[],installPrompt=null,installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,lastTurnKey='';
const params=new URLSearchParams(location.hash.slice(1)),hint=params.get('arcadeName');
$('name').value=read('skull-name')||(hint&&hint.length<=32?hint:'');
if(params.has('arcadeName')){params.delete('arcadeName');history.replaceState(null,'',location.pathname+location.search+(params.size?'#'+params:''));}
$('name').onchange=()=>write('skull-name',$('name').value.trim());
audio.alertsEnabled=read('skull-turn-chime')!=='false';
const alerts=new TurnAlerts({localId:session?.playerId,onAlert:()=>{audio.play('turn');if(read('skull-turn-vibration')!=='false'){try{navigator.vibrate?.([90,65,130]);}catch{}}},isVisible:()=>!document.hidden});
document.addEventListener('pointerdown',()=>{audio.unlock().catch(()=>{});if(read('skull-sound')==='true'&&!audio.enabled)audio.toggle().catch(()=>{});},{once:true});
document.addEventListener('visibilitychange',async()=>{if(document.hidden){cancelFeedback();celebrate=false;$('table-screen').dataset.celebrate='false';feedbackTracker.reset();}try{await audio.syncVisibility();}catch{}alerts.flush();});
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');motionPreference.addEventListener('change',()=>{cancelFeedback();celebrate=false;$('table-screen').dataset.celebrate='false';});
function open(html){content.innerHTML=html;const title=content.querySelector('h2');if(title){title.id='dialog-title';modal.setAttribute('aria-labelledby',title.id);}modal.scrollTop=0;if(!modal.open)modal.showModal();audio.play('creak');}
$('modal').querySelector('.close').onclick=()=>modal.close();
modal.addEventListener('close',()=>{if(room)render();});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
function cancelFeedback(){document.querySelectorAll('.sea-cue,.card-flight').forEach(e=>e.remove());for(const a of effectAnimations)a.cancel();effectAnimations=[];activeEffects.clear();clearTimeout(effectTimer);}
function noticeHeight(){const height=$('recovery-bar').hidden?($('lifecycle-bar').hidden?0:$('lifecycle-bar').getBoundingClientRect().height):$('recovery-bar').getBoundingClientRect().height;document.documentElement.style.setProperty('--notice-height',height+'px');}
window.addEventListener('resize',noticeHeight);
function lifecycle(message,temporary=false){clearTimeout(lifecycleTimer);$('lifecycle-message').textContent=message;$('lifecycle-bar').hidden=!message;noticeHeight();if(temporary)lifecycleTimer=setTimeout(()=>{if(document.activeElement!==$('dismiss-lifecycle'))lifecycle('');},4500);}
$('dismiss-lifecycle').onclick=()=>{lifecycle('');const target=document.querySelector(room?.match?'.turn-banner strong':room?'#room-code':'#title');if(target){target.tabIndex=-1;target.focus({preventScroll:true});}};
function recovery(message){
 if(message&&!connectionStarted)connectionStarted=Date.now();
 if(!message)connectionStarted=0;
 $('recovery-message').textContent=message;$('recovery-bar').hidden=!message;
 $('retry-connection').hidden=!message||!session;$('recovery-leave').hidden=!session;noticeHeight();
}
$('retry-connection').onclick=()=>{if(socket&&socket.readyState!==WebSocket.CLOSED){socket.close();}else connect();};
$('recovery-leave').onclick=()=>leave();
function receiveFeedback(next,{baseline=false}={}){
 const events=feedbackTracker.update(next,{quiet:baseline||document.hidden});
 if(baseline){cancelFeedback();celebrate=false;}
 if(events.some(e=>e.kind==='deal')||room?.match?.trick!==next.match?.trick){cancelFeedback();$('trick-feedback').open=false;}
 const lifecycleEvents=events.filter(e=>['host','takeover','returned','disconnected','removed'].includes(e.kind));if(lifecycleEvents.length)lifecycle(lifecycleEvents.slice(0,2).map(e=>outcomeText(e,name)).join(' ')+(lifecycleEvents.length>2?` ${lifecycleEvents.length-2} more seat changes; see Your crew in settings.`:''));
 const sound=[['finished','victory'],['round','coins'],['reveal','reveal'],['deal','deal'],['draw','deal'],['play','swish']].find(([kind])=>events.some(e=>e.kind===kind));if(sound&&!document.hidden)audio.play(sound[1]);
 const outcomeMessages=events.filter(e=>e.kind==='outcome').map(e=>outcomeText(e,name));if(outcomeMessages.length)$('effect-announcement').textContent=outcomeMessages.slice(0,2).join(' ')+(outcomeMessages.length>2?' More details in What changed this trick.':'');
 for(const event of events){
  if(['host','takeover','returned','disconnected','removed'].includes(event.kind))continue;
  if(document.hidden)continue;
    if(event.kind==='reveal')lifecycle('All bids are revealed. Match your bid exactly.',true);
  if(event.kind==='finished')celebrate=true;
  const key=event.id||`${event.kind}:${event.cardId||event.actorId||''}`;
  let origin=null;
  if(event.kind==='play'){
   const play=next.match?.plays.find(p=>p.card.id===event.cardId);
   const hand=Array.from(document.querySelectorAll('#hand [data-card-id]')).find(el=>el.dataset.cardId===event.cardId);
   const seat=Array.from(document.querySelectorAll('.seat')).find(el=>el.dataset.player===play?.playerId);
   const source=hand||seat?.querySelector('.avatar');
   if(source){const r=source.getBoundingClientRect();if(r.width&&r.height)origin={x:r.x,y:r.y,width:r.width,height:r.height,local:!!hand};}
  }
  activeEffects.set(key,{...event,origin,start:performance.now(),duration:event.kind==='deal'?480:event.kind==='play'?440:360});
 }
 if(next.match?.phase!=='finished'){celebrate=false;audio.stopVictory();}
 while(activeEffects.size>24)activeEffects.delete(activeEffects.keys().next().value);
}
function paintFeedback(){
 document.querySelectorAll('.sea-cue,.card-flight').forEach(e=>e.remove());
 for(const a of effectAnimations)a.cancel();effectAnimations=[];
 const now=performance.now(),m=room?.match;
 $('table-screen').dataset.celebrate=String(celebrate);
 const notes=(m?.feedback||[]).map(e=>outcomeText(e,name));
 $('feedback-list').innerHTML=notes.map(t=>`<li>${escapeHtml(t)}</li>`).join('');$('trick-feedback').hidden=!notes.length;
 // Final scores retain the last-trick explanation even though the hand is hidden.
 if(m?.phase==='finished'&&!$('final-feedback')&&notes.length){const details=document.createElement('details');details.id='final-feedback';details.innerHTML=`<summary>Final trick explained</summary><ul>${notes.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul>`;$('final-ledger')?.prepend(details);}
 const effects=m?.feedback||[],removals=new Map(effects.filter(e=>['plank','locker'].includes(e.kind)).flatMap(e=>(e.cardIds||[]).map(id=>[id,e.kind==='locker'?'CANCELLED':'REMOVED'])));
 const suitsIgnored=effects.some(e=>['whale','stingray'].includes(e.kind));
 const destroyed=effects.some(e=>e.kind==='kraken'),neutral=new Set(effects.filter(e=>['whale','stingray'].includes(e.kind)).flatMap(e=>e.cardIds||[]));
 document.querySelectorAll('[data-public]').forEach(el=>{
  const label=removals.get(el.dataset.public)||(destroyed?'TRICK LOST':neutral.has(el.dataset.public)?'RANK VOID':'');
  el.classList.toggle('effect-removed',!!removals.get(el.dataset.public));el.classList.toggle('effect-neutral',neutral.has(el.dataset.public));el.classList.toggle('effect-destroyed',destroyed);
  const number=m?.plays?.find(p=>p.card.id===el.dataset.public)?.card.type==='number';el.classList.toggle('effect-suit-ignored',suitsIgnored&&number);
  el.dataset.resolution=label;if(label)el.setAttribute('aria-label',el.getAttribute('aria-label')+' · '+label.toLowerCase());else if(suitsIgnored&&number)el.setAttribute('aria-label',el.getAttribute('aria-label')+' · suits ignored; compare number');
 });
 if(document.hidden||motionPreference.matches||typeof Element.prototype.animate!=='function')return;
 for(const [key,e]of activeEffects){const elapsed=now-e.start;if(elapsed>=e.duration){activeEffects.delete(key);continue;}
  let targets=[];
  if(e.kind==='play')targets=Array.from(document.querySelectorAll('[data-public]')).filter(el=>el.dataset.public===e.cardId);
  else if(e.kind==='draw')targets=Array.from(document.querySelectorAll('[data-card-id]')).filter(el=>el.dataset.cardId===e.cardId);
  else if(e.kind==='deal')targets=Array.from(document.querySelectorAll('#hand .card'));
  else if(e.kind==='reveal')targets=Array.from(document.querySelectorAll('.seat .progress'));
  else if(e.kind==='leader')targets=Array.from(document.querySelectorAll('.seat')).filter(el=>el.dataset.player===e.actorId);
  else if(e.kind==='round')targets=Array.from(document.querySelectorAll('.podium-place b'));
  else if(e.kind==='outcome')targets=Array.from(document.querySelectorAll('[data-public]')).filter(el=>e.cardIds?.includes(el.dataset.public));
  if(e.kind==='outcome'&&['kraken','whale','stingray','locker'].includes(e.effect)){const wave=document.createElement('div');wave.className=`sea-cue sea-${e.effect}`;wave.setAttribute('aria-hidden','true');$('table').append(wave);const animation=wave.animate([{opacity:0,transform:'translateX(-35%)'},{opacity:.5,offset:.4},{opacity:0,transform:'translateX(35%)'}],{duration:e.duration,easing:'ease-out'});animation.currentTime=elapsed;effectAnimations.push(animation);animation.onfinish=()=>wave.remove();}
  targets.forEach((el,i)=>{const duration=e.duration,delay=e.kind==='deal'?Math.min(i*25,200):0;
   if(e.kind==='play'&&e.origin){
    const r=el.getBoundingClientRect(),o=e.origin;
    if(r.width&&r.height){
     // A viewport overlay avoids clipping inside the seat and hand containers.
     const flight=el.cloneNode(true);flight.classList.add('card-flight');flight.removeAttribute('data-public');flight.removeAttribute('aria-label');flight.setAttribute('aria-hidden','true');flight.tabIndex=-1;flight.inert=true;
     // Preserve responsive face styling when the clone leaves the table's CSS scope.
     const originals=[el,...el.querySelectorAll('*')],copies=[flight,...flight.querySelectorAll('*')];
     originals.forEach((node,index)=>{const style=getComputedStyle(node);for(const property of style)copies[index].style.setProperty(property,style.getPropertyValue(property));});
     Object.assign(flight.style,{position:'fixed',left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',margin:'0',zIndex:'1000',pointerEvents:'none',maxWidth:'none',transformOrigin:'center',animation:'none'});
     document.body.append(flight);
     const dx=o.x+o.width/2-r.x-r.width/2,dy=o.y+o.height/2-r.y-r.height/2;
     const scale=o.local?o.width/r.width:.65;
     const travel=flight.animate([{transform:`translate(${dx}px,${dy}px) rotate(${dx>0?8:-8}deg) scale(${scale})`,opacity:o.local?1:.25},{transform:`translate(${dx*.3}px,${dy*.3-18}px) rotate(0deg) scale(1.06)`,opacity:1,offset:.65},{transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1}],{duration,easing:'cubic-bezier(.22,.7,.25,1)'});
     const hidden=el.animate([{opacity:0},{opacity:0}],{duration});
     travel.currentTime=hidden.currentTime=elapsed;effectAnimations.push(travel,hidden);travel.onfinish=()=>flight.remove();
    }
   }
   if(['deal','draw'].includes(e.kind)){for(const child of el.children){const arrival=child.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:duration-delay,delay,easing:'ease-out'});arrival.currentTime=elapsed;effectAnimations.push(arrival);}}
   const animation=el.animate([{boxShadow:'0 0 0 3px #a2f5df, 0 0 16px #a2f5df',filter:'brightness(1.25)'},{boxShadow:'0 0 0 0 transparent',filter:'brightness(1)'}],{duration:duration-delay,delay,easing:'ease-out'});animation.currentTime=elapsed;effectAnimations.push(animation);
  });
 }
 clearTimeout(effectTimer);if(activeEffects.size)effectTimer=setTimeout(()=>{activeEffects.clear();for(const a of effectAnimations)a.cancel();effectAnimations=[];},500);
}
function notice(message){$('connection-status').hidden=!message||!!room;$('connection-status').textContent=message||'';$('action-error').textContent=room?message||'':'';}
function entryBusy(){return !!inFlight||!!pending||!!session&&!connectionReady;}
function syncBusy(){
 for(const id of ['create','join'])$(id).disabled=entryBusy();
 if($('join-now'))$('join-now').disabled=entryBusy()||!/^[A-Z]{5}$/.test($('join-code').value);
 for(const b of document.querySelectorAll('#lock-bid,#continue,[data-bid],[data-choice],.demo-play,[data-play-choice]')){
  if(inFlight||room&&!connectionReady){if(b.dataset.pendingDisabled===undefined)b.dataset.pendingDisabled=String(b.disabled);b.disabled=true;}
  else if(b.dataset.pendingDisabled!==undefined){b.disabled=b.dataset.pendingDisabled==='true';delete b.dataset.pendingDisabled;}
 }
}
function submit(action){
 pendingFocus=focusTarget();actionError='';const requestId=String(++requestSequence);inFlight={...action,requestId};
 socket.send(JSON.stringify(inFlight));if(action.type!=='resume')notice('Waiting for the table…');syncBusy();
 clearTimeout(actionTimer);actionTimer=setTimeout(()=>{
  recovery('No response yet. Checking the table without replaying your action…');
  socket?.close();
 },15000);
}
function settle(){clearTimeout(actionTimer);inFlight=null;}
function focusTarget(){
 const active=document.activeElement;
 if(!active||active===document.body)return null;
 if(active.id)return {id:active.id};
 for(const key of ['cardId','bid','choice','public','playChoice'])if(active.dataset[key]!==undefined)return {key,value:active.dataset[key]};
 return null;
}
function render(){
 const before=focusTarget()||pendingFocus,active=document.activeElement,phase=room?.match;
 const key=phase?`${phase.round}:${phase.trick}:${phase.phase}:${phase.phase==='decision'?phase.revision:phase.turn}`:room?'lobby':'opening';
 renderContent();syncBusy();paintFeedback();updateCountdowns();
 const heading=document.querySelector(phase?.phase==='bidding'?'#bidding-view h2':phase&&['decision','trick','round','finished'].includes(phase.phase)?'#phase-panel h3':phase?'.turn-banner strong':room?'#room-code':'#title');
 if(!modal.open){
  let target=before?.id?$(before.id):before?Array.from(document.querySelectorAll('[data-'+before.key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']')).find(e=>e.dataset[before.key]===before.value):null;
  if(key!==lastFocusPhase||active===document.body||!active?.isConnected||active.closest('[hidden]')||active.disabled){
   if(key!==lastFocusPhase||!target||target.disabled||target.closest('[hidden]'))target=heading;
   if(target){if(!target.matches('button,input,a'))target.tabIndex=-1;target.focus({preventScroll:true});}
  }
 }
 lastFocusPhase=key;if(!inFlight)pendingFocus=null;
 const announcement=phase?document.querySelector('.turn-banner strong').textContent:'';
 if(announcement!==lastAnnouncement){$('game-announcement').textContent=announcement;lastAnnouncement=announcement;}
}
function connect(action){
 leaving=false;
 if(action){if(entryBusy())return;pending=action;syncBusy();}
 if(socket?.readyState===WebSocket.OPEN){if(pending){const next=pending;pending=null;submit(next);}return;}
 if(socket?.readyState===WebSocket.CONNECTING)return;
 clearTimeout(retryTimer);connectionReady=false;recovery('Connecting to your table…');feedbackTracker.reset();cancelFeedback();
 let url=websocketUrl||new URL('./socket',location.href).href.replace(/^http/,'ws');
 try{socket=new WebSocket(url);}catch{pending=null;settle();syncBusy();recovery('');notice('Unable to connect. Check your connection and try again.');return;}
 clearTimeout(actionTimer);actionTimer=setTimeout(()=>socket?.close(),15000);
 socket.onopen=()=>{retry=0;if(pending){const next=pending;pending=null;submit(next);}else if(session)submit({type:'resume',code:session.code,token:session.token});};
 socket.onmessage=event=>{let data;try{data=JSON.parse(event.data);}catch{return;}
  if(data.type==='welcome'){session={code:data.code,playerId:data.playerId,token:data.token};write('skull-session',JSON.stringify(session));alerts.localId=session.playerId;}
  if(data.type==='state'){const resumed=inFlight?.type==='resume',baseline=!connectionReady;receiveFeedback(data.room,{baseline});connectionReady=true;room=data.room;recovery('');if(resumed)lifecycle('Connected. Your table is restored at its current state.',true);if(inFlight&&['create','join','resume'].includes(inFlight.type)){settle();if(modal.open&&$('join-code'))modal.close();}notice(actionError||(inFlight?'Waiting for the table…':''));render();}
  if(data.type==='ack'&&data.requestId===inFlight?.requestId){settle();syncBusy();notice(actionError);}
  if(data.type==='error'){recovery('');actionError=data.message;settle();pending=null;render();notice(data.message);if($('join-error'))$('join-error').textContent=data.message;if(/expired|not found|invalid.*token|seat.*removed|cannot be reclaimed/i.test(data.message)){write('skull-session',null);session=null;room=null;alerts.clear();recovery('');lifecycle('');cancelFeedback();feedbackTracker.reset();render();notice(data.message);}}
 };
 socket.onclose=event=>{connectionReady=false;settle();pending=null;cancelFeedback();feedbackTracker.reset();if(leaving){leaving=false;return;}if(event.code===4001){session=null;room=null;alerts.clear();recovery('');render();notice('This seat was opened elsewhere. Continue in that window.');return;}render();if(session){recovery('Connection lost. Reconnecting to check your seat…');retryTimer=setTimeout(()=>connect(),Math.min(1000*2**retry++,15000));}else{recovery('');notice('Unable to connect. Try again.');}};
 socket.onerror=()=>recovery('Connection unavailable. Waiting to reconnect…');
}
function send(action){
 if(inFlight)return false;
 if(socket?.readyState!==WebSocket.OPEN||!connectionReady){notice('Reconnecting—wait before playing.');connect();return false;}
 submit(room?.match&&['bid','play','choose','continue'].includes(action.type)?{...action,revision:room.match.revision}:action);return true;
}
const myId=()=>session?.playerId,host=()=>room?.hostId===myId(),name=id=>room?.players.find(p=>p.id===id)?.name||'Player';
$('create').onclick=()=>{const value=$('name').value.trim()||'Captain';write('skull-name',value);connect({type:'create',name:value,expansion:false});};
$('join').onclick=()=>{
 open('<h2>Find your crew</h2><form id="join-form"><label for="join-code">FIVE-LETTER TABLE CODE</label><input id="join-code" maxlength="5" required pattern="[A-Z]{5}" aria-describedby="join-help join-error" autocomplete="off" autocapitalize="characters" placeholder="OCEAN"><p id="join-help">Enter the five letters shared by your captain.</p><p id="join-error" role="status"></p><button class="primary join-action" id="join-now" disabled>Join table →</button></form>');
 $('join-code').oninput=()=>{$('join-code').value=$('join-code').value.replace(/[^a-z]/gi,'').toUpperCase();$('join-error').textContent='';syncBusy();};
 $('join-form').onsubmit=e=>{e.preventDefault();if(entryBusy()||!/^[A-Z]{5}$/.test($('join-code').value))return;connect({type:'join',code:$('join-code').value,name:$('name').value.trim()||'Captain'});};$('join-code').focus();
};
function leave(){if(!confirm('Leave this table? A bot will keep your seat during an active match.'))return;settle();send({type:'leave'});session=null;room=null;cancelFeedback();feedbackTracker.reset();recovery('');lifecycle('');write('skull-session',null);alerts.clear();audio.stopVictory();document.title='Skull King · Decadence Arcade';clearTimeout(retryTimer);leaving=true;socket?.close();render();notice('');}
$('leave-lobby').onclick=leave;$('home').onclick=leave;
$('ready').onclick=()=>send({type:'ready',ready:!room.players.find(p=>p.id===myId())?.ready});
$('add-bot').onclick=()=>send({type:'add-bot'});$('start').onclick=()=>send({type:'start'});
$('base-mode').onclick=()=>send({type:'mode',expansion:false});$('full-mode').onclick=()=>send({type:'mode',expansion:true});
$('share-room').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);$('share-room').textContent='Code copied!';}catch{$('share-room').textContent=`Share this code: ${room.code}`;}};
function theme(c){return ['pirate','skull-king','first-mate','tigress'].includes(c.type)?' theme-pirate':c.type==='mermaid'?' theme-mermaid':'';}
function declaredRole(c,choice){return c.type==='tigress'&&choice!==undefined?(choice==='pirate'?'PIRATE':'ESCAPE / SURRENDER'):c.choices&&choice!==undefined?`PLAYED AS ${choice}`:c.suit==='wild'&&choice?String(choice).toUpperCase():'';}
function face(c,choice){const rank=c.type==='number'&&c.choices&&choice!==undefined?String(choice):c.rank,role=declaredRole(c,choice);return `<span class="rank${['6','9'].includes(String(rank))?' marked-rank':''}">${escapeHtml(rank)}</span>${c.art?`<img class="portrait" src="./assets/${c.art}" alt="">`:`<span class="symbol" aria-hidden="true">${c.symbol||SUITS[c.suit]?.symbol||'✦'}</span>`}<span class="card-name">${escapeHtml(c.name)}</span>${role?`<span class="declared-role">${escapeHtml(role)}</span>`:''}${c.bonus?`<span class="bonus">${c.bonus>0?'+':''}${c.bonus} bonus*</span>`:''}`;}
function choiceCard(c){return `<span class="choice-card card suit-${c.kind}${theme(c)}">${face(c)}</span>`;}

function legal(c,choice){const m=room.match;return playError({phase:m.phase,turn:m.turn,hands:{[myId()]:m.hand},plays:m.plays,forced:m.forcedCardId?{[myId()]:m.forcedCardId}:{}},myId(),c.id,choice);}
function cardChoices(c){if(c.choices)return c.choices;if(c.suit==='wild')return ['yellow','purple','green'];return [undefined];}
function inspect(c){selected=c.id;const choices=cardChoices(c),errors=choices.map(choice=>legal(c,choice)),error=errors.every(Boolean)?errors[0]:null;
 $('ability').hidden=false;$('ability').innerHTML=`<button id="inspect-close" class="ability-close" aria-label="Close card details">×</button><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.ability)}</span>${choices.length>1&&!error?`<div class="choice-row">${choices.map((choice,i)=>`<button data-play-choice="${i}" ${errors[i]?'disabled':''}>${escapeHtml(choice)}</button>`).join('')}</div>`:`<button id="inspect-play" class="demo-play" ${error?'disabled':''}>${escapeHtml(error||'Play card · or swipe up ↑')}</button>`}`;
 $('ability').querySelector('.ability-close').onclick=()=>{$('ability').hidden=true;document.querySelectorAll('[data-card-id]').forEach(b=>{if(b.dataset.cardId===c.id)b.focus({preventScroll:true});});};
 const button=$('ability').querySelector('.demo-play');if(button)button.onclick=()=>play(c,choices[0]);
 $('ability').querySelectorAll('[data-play-choice]').forEach(b=>b.onclick=()=>play(c,choices[Number(b.dataset.playChoice)]));
 syncBusy();($('ability').querySelector('button:not(:disabled):not(.ability-close)')||$('ability').querySelector('.ability-close')).focus({preventScroll:true});
}
function play(c,choice){const error=legal(c,choice);if(error){notice(error);return;}send({type:'play',cardId:c.id,choice});}
function renderContent(){
 const m=room?.match;$('opening').hidden=!!room;$('lobby-screen').hidden=!room||!!m;$('table-screen').hidden=!m;
 if(!room)return;
 if(!m){$('room-code').textContent=room.code;$('base-mode').setAttribute('aria-pressed',String(!room.expansion));$('full-mode').setAttribute('aria-pressed',String(room.expansion));$('base-mode').disabled=!host();$('full-mode').disabled=!host();$('crew-list').innerHTML=room.players.map(p=>`<div class="crew-member"><span class="crew-avatar">${p.bot?'⚙':'⚓'}</span><strong>${escapeHtml(p.name)}${p.id===room.hostId?' · HOST':''}</strong><span>${p.bot?'BOT':!p.connected?`Disconnected <span data-until="${Number(p.disconnectedUntil)||0}"></span>`:p.ready?'✓ Ready':'Choosing…'}</span>${host()&&p.id!==myId()?`<button data-kick="${p.id}" class="text-button">Remove</button>`:''}</div>`).join('');$('crew-list').querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>send({type:'kick',playerId:b.dataset.kick}));const me=room.players.find(p=>p.id===myId());$('ready').textContent=me?.ready?'✓ Ready · tap to unready':'Ready to sail';$('add-bot').hidden=!host();$('start').hidden=!host();$('start').disabled=room.players.length<2||room.players.some(p=>!p.bot&&(!p.ready||!p.connected));$('lobby-status').textContent=host()?'Start when everyone is ready.':'Waiting for the captain to set sail.';return;}
 const signature=`${m.round}:${m.trick}:${m.phase}:${m.turn}:${m.plays.length}:${m.phase==='decision'?m.revision:''}`;
 if(signature!==lastEvent){if(m.phase!=='finished')audio.stopVictory();$('ability').hidden=true;selected=null;choiceSelection=[];if(m.phase==='bidding'&&!lastEvent.startsWith(`${m.round}:${m.trick}:bidding`))bidChoice=null;lastEvent=signature;}
 document.querySelector('.table-heading h2').innerHTML=`Round ${m.round} <small>/ 10</small>`;
 document.querySelector('.table-heading .eyebrow').textContent=`TABLE ${room.code} · ${m.trick?`TRICK ${m.trick}`:'BIDDING'}`;
 const banner=document.querySelector('.turn-banner strong'),sub=document.querySelector('.turn-banner span');
 banner.textContent=m.phase==='play'?(m.turn===myId()?'Your turn, Captain':`${name(m.turn)}’s turn`):m.phase==='bidding'?'Make your prediction':m.phase==='decision'?`${name(m.decision?.playerId)} uses a power`:m.phase==='trick'?(m.result?.winnerId?`${name(m.result.winnerId)} takes the trick`:'The trick is destroyed'):m.phase==='round'?'The captain’s ledger':'A new ruler of the seas';
 sub.textContent=m.phase==='play'?`${m.plays.length} cards played · ${m.dealt} dealt this round`:m.phase==='bidding'?'Study your hand. Bids reveal together.':m.phase==='decision'?'Resolve the card’s power to continue.':'';
 const table=$('table');table.hidden=m.phase==='bidding';const layout=tableLayout(room.players,myId());table.dataset.players=room.players.length;table.style.setProperty('--play-columns',layout.columns);table.replaceChildren();
 const leaders=[...m.players].sort((a,b)=>b.score-a.score);let leading=null;try{leading=m.leadingPlayerId;}catch{}
 room.players.forEach((p,i)=>{const stats=m.players.find(x=>x.id===p.id)||{},point=layout.seats[i],seat=document.createElement('div');seat.className='seat'+(p.id===m.turn&&m.phase==='play'?' active-turn':'')+(p.id===leading?' leading':'');seat.dataset.edge=point.edge||'cap';seat.style.setProperty('--seat-x',point.x+'%');seat.style.setProperty('--seat-y',point.y+'%');seat.dataset.player=p.id;const cards=m.plays.filter(x=>x.playerId===p.id),art=['rosie.jpg','bendt.jpg','rascal.jpg','juanita.jpg','harry.jpg','tigress.jpg','first-mate.png','mary.jpg','mermaid.jpg','skull-king.png'][i];seat.innerHTML=`<span class="avatar"><img src="./assets/${art}" alt="">${p.id===m.turn&&m.phase==='play'?`<span class="turn-indicator">${p.id===myId()?'YOUR TURN':'PLAYING'}</span>`:''}${!p.connected&&!p.bot?`<span class="disconnect-clock" data-until="${p.disconnectedUntil||0}"></span>`:''}</span><div><strong>${leaders[0]?.id===p.id?'♛ ':leaders[1]?.id===p.id?'♕ ':''}${escapeHtml(p.name)}</strong><span class="progress">${stats.won||0} won / ${stats.bid??'—'} bid</span><span class="badge">${p.bot?'BOT':p.id===myId()?'YOU':''}</span></div><div class="played">${cards.length?cards.map(c=>`<button class="mini-card suit-${c.card.kind}${theme(c.card)}" aria-label="${escapeHtml(p.name)} played ${escapeHtml(c.card.name)} ${escapeHtml(declaredRole(c.card,c.choice))}" data-public="${c.card.id}">${face(c.card,c.choice)}</button>`).join(''):`<span class="waiting-card">${p.id===m.turn?'Your turn':'Not played'}</span>`}</div>`;seat.querySelectorAll('[data-public]').forEach(b=>b.onclick=()=>{const played=cards.find(x=>x.card.id===b.dataset.public),c=played.card;open(`<h2>${escapeHtml(c.name)}</h2><div class="enlarged-card card suit-${c.kind}${theme(c)}">${face(c,played.choice)}</div>${declaredRole(c,played.choice)?`<p class="role-explanation">Played as ${escapeHtml(declaredRole(c,played.choice))}.</p>`:''}<p>${escapeHtml(c.ability)}</p>`);});table.append(seat);});
 $('hand').replaceChildren();$('hand').dataset.count=m.hand.length;
 for(const c of m.hand){const holder=document.createElement('div');holder.className='hand-card';const b=document.createElement('button'),choices=cardChoices(c),error=m.phase==='play'&&choices.every(choice=>legal(c,choice));b.dataset.cardId=c.id;b.className=`card suit-${c.kind}${theme(c)}${error?' illegal':''}${m.forcedCardId===c.id?' selected':''}`;b.innerHTML=face(c);b.setAttribute('aria-label',`Inspect ${c.name}`);const reason=choices.map(choice=>legal(c,choice)).find(Boolean);b.dataset.blockedLabel=error?(m.turn!==myId()?'WAIT TURN':m.forcedCardId&&m.forcedCardId!==c.id?'MARY CHOSE ANOTHER':reason?.startsWith('Follow ')?reason.split(',')[0].toUpperCase():'CANNOT PLAY'):'';b.setAttribute('aria-label',`Inspect ${c.name}${error?'. '+reason:''}`);let start=null,swiped=false;b.onclick=()=>{if(swiped){swiped=false;return;}inspect(c);};b.onpointerdown=e=>{start={x:e.clientX,y:e.clientY};b.setPointerCapture(e.pointerId);};b.onpointerup=e=>{if(start&&start.y-e.clientY>40&&Math.abs(start.x-e.clientX)<65){swiped=true;if(choices.length>1)inspect(c);else play(c,choices[0]);}start=null;};b.onpointercancel=()=>start=null;holder.append(b);$('hand').append(holder);}
 $('table-note').textContent=m.forcedCardId?'Mary has selected your marked card. You must play it when your turn arrives.':m.phase==='play'?'Tap a card for its power. Swipe up to play a legal card.':'Your hand stays private.';
 renderPhase(m);if(m.phase==='finished'&&modal.open)modal.close();const key=`${m.matchId||room.code}:${m.round}:${m.trick}:${m.turn}:${m.plays.length}`;if(m.phase==='play'&&m.turn===myId())document.title='Your turn! · Skull King';else document.title='Skull King · Decadence Arcade';alerts.update({phase:m.phase,turn:m.turn,key});lastTurnKey=key;updateCountdowns();
}
function renderPhase(m){
 const bidding=$('bidding-view'),panel=$('phase-panel');bidding.hidden=m.phase!=='bidding';panel.hidden=!['decision','trick','round','finished'].includes(m.phase);panel.classList.toggle('finished-view',m.phase==='finished');$('hand').closest('.hand-zone').hidden=m.phase==='finished';
 if(m.phase==='bidding'){
  if(bidChoice!==null&&(bidChoice<0||bidChoice>m.dealt))bidChoice=null;
  const me=m.players.find(p=>p.id===myId()),pendingCount=m.players.filter(p=>!p.bidLocked).length;
  bidding.innerHTML=`<div class="bid-heading"><span class="eyebrow">${me.bidLocked?'PREDICTION SEALED':'TRUST YOUR HAND'}</span><h2>${me.bidLocked?`You bid ${me.bid}`:'How many tricks?'}</h2><p>${me.bidLocked?`Waiting for ${pendingCount} ${pendingCount===1?'player':'players'}`:`Choose 0–${m.dealt}. Match your bid exactly.`}</p></div>${!me.bidLocked?`<div class="bid-choices" role="group" aria-label="Choose your bid">${Array.from({length:m.dealt+1},(_,i)=>`<button data-bid="${i}" aria-pressed="${bidChoice===i}">${i}</button>`).join('')}</div><button class="primary" id="lock-bid" ${bidChoice===null?'disabled':''}>LOCK ${bidChoice??'YOUR'} BID ⚓</button>`:`<div class="sealed-bid"><span>⚓</span><b>${me.bid}</b><small>YOUR BID</small></div>`}<div class="bid-crew">${m.players.map(p=>`<div><span>${escapeHtml(name(p.id))}</span><b>${p.id===myId()&&p.bidLocked?p.bid:p.bidLocked?'✓ Locked':'Choosing…'}</b></div>`).join('')}</div>`;
  bidding.querySelectorAll('[data-bid]').forEach(b=>b.onclick=()=>{bidChoice=Number(b.dataset.bid);audio.play();renderPhase(m);bidding.querySelector(`[data-bid="${bidChoice}"]`).focus({preventScroll:true});});
  if($('lock-bid'))$('lock-bid').onclick=()=>{if(send({type:'bid',bid:bidChoice}))audio.play('bell');};
 }
 if(m.phase==='decision'){
  const d=m.decision,owner=d.playerId===myId();
  panel.innerHTML=`${d.source?.art?`<img class="power-source" src="./assets/${escapeHtml(d.source.art)}" alt="${escapeHtml(d.source.name)}">`:''}<span class="eyebrow">${owner?'YOUR CARD POWER':`${escapeHtml(name(d.playerId))} IS CHOOSING`}</span><h3>${escapeHtml(d.title.replaceAll(d.targetId||'__none__',name(d.targetId)))}</h3>${owner?`${d.cards?`<p class="disclaimer">Private view · only you can see these cards.</p><div class="reserve-cards">${d.cards.map(c=>`<div class="card suit-${c.kind}${theme(c)}">${face(c)}</div>`).join('')}</div>`:''}<div class="power-options live-options">${d.options.map((o,i)=>`<button data-choice="${i}">${o.card?choiceCard(o.card):''}${escapeHtml(room.players.some(p=>p.id===o.label)?name(o.label):o.label)}</button>`).join('')}</div>`:'<p>Waiting for the card’s owner. Their private choices stay hidden.</p>'}`;
  panel.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{if(send({type:'choose',value:d.options[Number(b.dataset.choice)].value}))audio.play('power');});
 }
 if(m.phase==='trick'){
  const won=m.result?.winnerId;
  panel.innerHTML=`<span class="power-seal" aria-hidden="true">${won?'✦':'≈'}</span><h3>${won?`${escapeHtml(name(won))} wins the trick`:'No one takes this trick'}</h3><p>${escapeHtml(m.result?.reason||(m.result?.removedIds?.length?'A pirate walked the plank. Its capture bonus is removed.':won?'The cards are gathered. On to the next trick.':'The sea has swallowed the battle.'))}</p><button class="primary" id="continue">${m.trick===m.dealt?'See round results':'Next trick →'}</button>`;
 }
 if(m.phase==='finished'&&panel.dataset.finishedMatch===m.matchId&&m.matchId)return;
 panel.dataset.finishedMatch=m.phase==='finished'?m.matchId||'':'';
 if(['round','finished'].includes(m.phase)){
  const sorted=[...m.players].sort((a,b)=>b.score-a.score),max=sorted[0].score,winners=sorted.filter(p=>p.score===max);
  panel.innerHTML=`${m.phase==='finished'?victoryMarkup({winners:winners.map(p=>({...p,name:name(p.id)})),score:max,localWinner:winners.some(p=>p.id===myId()),escape:escapeHtml}):`<span class="eyebrow">ROUND COMPLETE</span><h3>Round ${m.round} scored</h3>${podium(sorted)}`}<div id="final-ledger">${m.phase==='finished'?`<h3 class="final-ledger-title">The captain’s ledger</h3>${podium(sorted)}${ledgerBody(m)}`:'<button class="secondary" id="round-ledger">View scores & bonuses</button>'}</div>${m.phase==='round'?'<button class="primary" id="continue">Deal next round →</button>':host()?'<button class="primary" id="rematch">Sail again · rematch →</button>':'<p>Waiting for the captain to start a rematch.</p>'}`;
  if($('victory-music'))$('victory-music').onclick=async()=>{try{await audio.unlock();if(!audio.enabled){await audio.toggle();write('skull-sound','true');}audio.play('victory');}catch{$('victory-music').textContent='Sound unavailable in this browser';}};
  if($('round-ledger'))$('round-ledger').onclick=standings;if($('rematch'))$('rematch').onclick=()=>send({type:'rematch'});
 }
 if($('continue'))$('continue').onclick=()=>{send({type:'continue'});};
}
function podium(sorted){return `<div class="podium">${sorted.slice(0,3).map((p,i)=>`<div class="podium-place place-${i+1}"><span>${i===0?'♛':i===1?'♕':'✦'}</span><strong>${escapeHtml(name(p.id))}</strong><b>${p.score}</b><small>POINTS</small></div>`).join('')}</div>`;}
function ledgerTable(rows,{total=true,caption=''}={}){return `<div class="ledger-scroll"><table class="ledger">${caption?`<caption>${escapeHtml(caption)}</caption>`:''}<thead><tr><th scope="col">Player</th><th scope="col">Won / Bid</th><th scope="col">Bid pts</th><th scope="col">Bonus</th><th scope="col">Round</th>${total?'<th scope="col">Total</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${escapeHtml(name(r.id))}</th><td>${r.won!==undefined?`${r.won} / ${r.bid}`:'—'}</td><td>${r.bidPoints??'—'}</td><td>${r.bonus??'—'}</td><td>${r.total??'—'}</td>${total?`<td>${r.score??'—'}</td>`:''}</tr>`).join('')}</tbody></table></div>`;}
function ledgerBody(m){const sorted=[...m.players].sort((a,b)=>b.score-a.score),last=m.history.at(-1),rows=sorted.map(p=>({...last?.results.find(r=>r.id===p.id),id:p.id,score:p.score}));return `${ledgerTable(rows,{caption:last?`Round ${last.round} results`:'Current standings'})}<p class="disclaimer">Capture bonuses require an exact bid. A lost wager is deducted even when the bid is missed.</p><div class="round-history">${m.history.map(h=>`<details><summary>Round ${h.round}</summary>${ledgerTable([...h.results].sort((a,b)=>b.score-a.score),{caption:`Round ${h.round}`})}${h.results.some(r=>r.breakdown?.length)?`<div class="bonus-details">${h.results.filter(r=>r.breakdown?.length).map(r=>`<p><b>${escapeHtml(name(r.id))}:</b> ${r.breakdown.map(b=>escapeHtml(b.label)+': '+b.points).join(' · ')}</p>`).join('')}</div>`:''}</details>`).join('')}</div>`;}
function standings(){const m=room?.match;if(!m)return;const sorted=[...m.players].sort((a,b)=>b.score-a.score);open(`<h2>The captain’s ledger</h2>${podium(sorted)}${ledgerBody(m)}`);}

$('scores').onclick=()=>{standings();audio.play('coins');};
function learn(){open(`<h2>How to play</h2><ol><li><b>Study your cards and bid.</b> Predict how many tricks you will win. Bids stay private until everyone locks.</li><li><b>Play in turn.</b> Follow the leading suit with numbered cards if you have it; specials may be played instead. Tap to inspect, swipe up to play.</li><li><b>Watch the battle.</b> Black is trump. Pirates beat numbers and Mermaids; Skull King beats pirates; a Mermaid defeats the King.</li><li><b>Make your bid.</b> An exact nonzero bid earns 20 per predicted trick; a miss loses 10 per trick difference. Zero bids gain or lose 10 times the number of cards dealt. Capture bonuses count only with an exact bid.</li><li><b>Rule the seas.</b> Highest score after ten rounds wins. With many players, the maximum possible deal repeats.</li></ol><button class="secondary" id="deck-guide">Explore every card →</button>`);$('deck-guide').onclick=cardGuide;}
function cardGuide(){open(`<h2>Know your crew</h2><p>Tap a card for its role, power and bonuses.</p><div class="power-grid">${SPECIALS.map((c,i)=>`<button class="power-tile ${theme(c).includes('pirate')?'red':c.type==='mermaid'?'blue':''}" data-guide="${i}"><img src="./assets/${c.art}" alt="" loading="lazy"><strong>${escapeHtml(c.name)}</strong><small>${c.expansion?'EXPANSION':c.advanced?'ADVANCED':'BASE'}</small></button>`).join('')}</div><details><summary>Numbered cards & bonuses</summary><p>Standard colored 14s give +10; Black 14 gives +20, with an exact bid. Expansion duplicate 7s subtract 5 and 8s add 5 bonus points. Suited 0/14 requires a value choice and gives no 14 bonus.</p></details>`);content.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>{const c=SPECIALS[Number(b.dataset.guide)];open(`<button id="back-guide" class="text-button">← All cards</button><h2>${escapeHtml(c.name)}</h2><div class="enlarged-card card suit-${c.kind}${theme(c)}">${face(c)}</div><p>${escapeHtml(c.ability)}</p>`);$('back-guide').onclick=cardGuide;});}
$('learn').onclick=learn;$('guide').onclick=learn;
function settings(){
 open(`<h2>Captain’s settings</h2><label class="settings-row">Game sounds<input type="checkbox" id="setting-sound" ${audio.enabled?'checked':''}></label><label class="settings-row">Turn chime<input type="checkbox" id="setting-chime" ${audio.alertsEnabled?'checked':''}></label><label class="settings-row">Phone vibration<input type="checkbox" id="setting-vibration" ${read('skull-turn-vibration')!=='false'?'checked':''} ${typeof navigator.vibrate==='function'?'':'disabled'}></label>${typeof navigator.vibrate!=='function'?'<p class="disclaimer">This browser does not support vibration.</p>':''}<button class="secondary" id="test-turn-alert">Test turn alert</button><p id="alert-test-status" role="status"></p><button class="secondary" id="install-app" ${installed?'disabled':''}>${installed?'App installed':'Install app'}</button><p id="install-status" role="status"></p>${room?`<h3>Your crew</h3><div id="manage-crew">${room.players.map(p=>`<div class="manage-row"><span>${escapeHtml(p.name)} ${p.bot?'· BOT':p.connected?'':'· Disconnected'}</span>${host()&&p.id!==myId()&&(!p.connected||p.bot)?`<button data-replace="${p.id}">Use bot</button><button data-remove="${p.id}">Kick</button>`:''}</div>`).join('')}</div><button class="text-button" id="leave-match">Leave table</button>`:''}`);
 $('test-turn-alert').onclick=async()=>{const notes=[];try{await audio.unlock();if(audio.alertsEnabled&&audio.context?.state==='running'){audio.play('turn');notes.push('Turn chime played.');}else notes.push('Turn chime is off or audio is unavailable.');}catch{notes.push('Audio unavailable in this browser.');}try{if(read('skull-turn-vibration')!=='false'&&typeof navigator.vibrate==='function'){notes.push(navigator.vibrate([90,65,130])?'Vibration requested.':'Vibration unavailable.');}else notes.push('Vibration is off or unsupported.');}catch{notes.push('Vibration unavailable.');}if($('alert-test-status'))$('alert-test-status').textContent=notes.join(' ');};
 $('setting-sound').onchange=async()=>{try{const enabled=await audio.toggle();write('skull-sound',String(enabled));$('setting-sound').checked=enabled;}catch{$('setting-sound').checked=false;}};
 $('setting-chime').onchange=()=>{audio.alertsEnabled=$('setting-chime').checked;write('skull-turn-chime',String(audio.alertsEnabled));audio.syncVisibility().catch(()=>{});};
 $('setting-vibration').onchange=()=>write('skull-turn-vibration',String($('setting-vibration').checked));
 $('install-app').onclick=async()=>{
  const button=$('install-app'),status=$('install-status');
  if(!installPrompt){status.textContent=installHelp();return;}
  const event=installPrompt;installPrompt=null;button.disabled=true;
  status.textContent='Waiting for your browser’s install dialog…';
  try{const result=await event.prompt();const choice=await(event.userChoice||Promise.resolve(result));status.textContent=installed?'App installed.':choice?.outcome==='accepted'?'Installation requested. Open Skull King from your home screen when ready.':'Installation cancelled. You can also install from your browser menu.';}
  catch{status.textContent=installHelp();}
  finally{if(button.isConnected)button.disabled=installed;}
 };
 content.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>{send({type:'bot-takeover',playerId:b.dataset.replace});modal.close();});content.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{send({type:'kick',playerId:b.dataset.remove});modal.close();});if($('leave-match'))$('leave-match').onclick=()=>{modal.close();leave();};
}
$('menu').onclick=settings;$('table-settings').onclick=settings;
function installHelp(){
 if(!window.isSecureContext)return 'To install, open Skull King using its HTTPS website in Chrome. Installation is unavailable on this connection.';
 if(/iPhone|iPad/.test(navigator.userAgent))return 'In Safari, open Share, then Add to Home Screen.';
 if(/Android/i.test(navigator.userAgent))return 'Open this page in Chrome, then tap ⋮ → Add to home screen → Install. If you opened it inside another app, choose Open in Chrome first. If already installed, open Skull King from your home screen.';
 return 'Open your browser menu and choose Install app or Add to Home Screen, if available.';
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if($('install-status'))$('install-status').textContent='Ready to install. Tap Install app.';});
window.addEventListener('appinstalled',()=>{installed=true;installPrompt=null;if($('install-app')){$('install-app').disabled=true;$('install-app').textContent='App installed';}if($('install-status'))$('install-status').textContent='App installed. Open Skull King from your home screen.';});
function updateCountdowns(){if(connectionStarted){const seconds=Math.floor((Date.now()-connectionStarted)/1000);$('recovery-elapsed').textContent=`${seconds}s elapsed`;}document.querySelectorAll('[data-until]').forEach(e=>{e.textContent=Math.max(0,Math.ceil((Number(e.dataset.until)-Date.now())/1000))+'s';});}
setInterval(updateCountdowns,1000);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
if(session)connect();
