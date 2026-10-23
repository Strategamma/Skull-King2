import WebSocket from 'ws';
import assert from 'node:assert/strict';
const url=process.env.WS_URL||'ws://localhost:3001/socket';
function client(){const ws=new WebSocket(url),c={ws,state:null,welcome:null,events:[]};c.open=new Promise((resolve,reject)=>{ws.on('open',resolve);ws.on('error',reject);});ws.on('close',(code,reason)=>c.closed=`${code}: ${reason}`);ws.on('message',raw=>{const m=JSON.parse(raw);c.events.push(m);if(m.type==='state')c.state=m.room;if(m.type==='welcome')c.welcome=m;});return c;}
const pause=()=>new Promise(r=>setTimeout(r,5));
async function until(test){const deadline=Date.now()+7000;while(!test()){if(Date.now()>deadline)throw Error('Timed out awaiting server state');await pause();}}
async function send(c,a,predicate){await new Promise(r=>setTimeout(r,140));const before=c.events.length;c.ws.send(JSON.stringify(a));await until(()=>{if(c.closed)throw Error(`Socket closed: ${c.closed}`);const error=c.events.slice(before).find(x=>x.type==='error');if(error)throw Error(`${a.type} in ${c.state?.match?.phase}: ${error.message}`);return c.events.length>before&&(predicate?predicate(c):true);});}
let a=client(),b=client();await Promise.all([a.open,b.open]);
try{
 await send(a,{type:'create',name:'Network captain',expansion:true},c=>!!c.state);const code=a.state.code;
 await send(b,{type:'join',code,name:'Network mate'},c=>!!c.state);await until(()=>a.state.players.length===2);
 assert.equal(JSON.stringify(a.state).includes(a.welcome.token),false);
 await send(a,{type:'ready',ready:true},c=>c.state.players.find(p=>p.id===c.welcome.playerId).ready);await send(b,{type:'ready',ready:true},c=>c.state.players.find(p=>p.id===c.welcome.playerId).ready);
 await send(a,{type:'start'},c=>!!c.state.match);await until(()=>!!b.state.match);
 let steps=0,reconnected=false;
 while(a.state.match.phase!=='finished'&&steps++<2000){
  const m=a.state.match;
  const id=m.phase==='bidding'?m.players.find(p=>!p.bidLocked)?.id:m.decision?.playerId||m.turn||a.welcome.playerId;
  const c=id===a.welcome.playerId?a:b;await until(()=>c.state.match.revision===a.state.match.revision);
  const view=c.state.match;let action;
  if(m.phase==='bidding')action={type:'bid',bid:Math.min(1,m.dealt)};
  else if(m.phase==='play'){const p=view.legalPlays[0];assert.ok(p);action={type:'play',...p};}
  else if(m.phase==='decision'){assert.ok(view.decision.options.length);action={type:'choose',value:view.decision.options.find(o=>o.value==='decline')?.value??view.decision.options[0].value};}
  else action={type:'continue'};
  const revision=view.revision;await send(c,{...action,revision},x=>x.state.match.revision>revision);await until(()=>a.state.match.revision>revision&&b.state.match.revision>revision);
  if(!reconnected&&a.state.match.round>=2){const credentials=b.welcome;b.ws.close();await until(()=>!a.state.players.find(p=>p.id===credentials.playerId).connected);b=client();await b.open;await send(b,{type:'resume',code,token:credentials.token},c=>!!c.state);assert.equal(b.welcome.playerId,credentials.playerId);reconnected=true;}
 }
 assert.equal(a.state.match.phase,'finished');assert.equal(a.state.match.history.length,10);assert.ok(reconnected);assert.ok(a.state.match.players.every(p=>Number.isFinite(p.score)));
 console.log(JSON.stringify({websocketMatch:'passed',rounds:10,steps,reconnect:'passed',privateTokens:'passed'}));
}finally{for(const c of [a,b]){if(c.ws.readyState===WebSocket.OPEN)c.ws.send(JSON.stringify({type:'leave'}));c.ws.close();}}
