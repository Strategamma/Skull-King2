// Local visual fixtures only; never served by the production server.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {WebSocketServer} from 'ws';
import {SPECIALS,numberCard} from '../../cards.js';
const special=id=>({...SPECIALS.find(c=>c.id===id),id});
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.searchParams.has('state'))res.setHeader('Set-Cookie',`fixture=${encodeURIComponent(url.searchParams.get('state'))}; SameSite=Lax; Path=/`);const relative=url.pathname;const file=path.resolve('.','.'+(relative==='/'?'/index.html':relative));const body=await readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.webmanifest')?'application/manifest+json':'image/'+(file.endsWith('.jpg')?'jpeg':'png')});res.end(body);}catch{res.writeHead(404).end();}});
const wss=new WebSocketServer({server});
let savedInteraction=null;
wss.on('connection',(ws,req)=>{
 let interaction=null;
 ws.on('message',raw=>{const a=JSON.parse(raw);
if(a.type==='resume'&&(req.headers.cookie||'').match(/fixture=(Interaction|Timeout)/))interaction=savedInteraction;
if(interaction){const {room,m,rejected}=interaction;
 if(a.type==='resume'){ws.send(JSON.stringify({type:'welcome',code:'OCEAN',playerId:'me',token:'visual-fixture'}));}
 else if(interaction.feedbackMode&&a.type==='play'){m.plays.push({playerId:'me',card:m.hand.find(c=>c.id===a.cardId)});m.hand=m.hand.filter(c=>c.id!==a.cardId);m.phase='trick';m.turn=null;m.result={winnerId:'p8',reason:'Mermaid captures the Skull King.'};m.feedback=[{id:'f1',kind:'plank',text:'Mary was removed and grants no capture bonus.',cardIds:['mary']},{id:'f2',kind:'locker',text:'Locker cancelled both sea creatures; its bonus requires an exact bid.',cardIds:['kraken','stingray']},{id:'f3',kind:'trick',text:'Mermaid captures the Skull King.',actorId:'p8',cardIds:['mermaid']},{id:'f4',kind:'bonus',text:'Capture bonuses remain provisional until the round is scored.'}];}
 else if(!rejected.has(a.type)){rejected.add(a.type);m.revision++;ws.send(JSON.stringify({type:'error',requestId:a.requestId,message:'The table has moved on. Try your action again.'}));}
 else if(a.type==='bid'){m.phase='play';m.turn='me';m.forcedCardId='green-2';m.players[0].bid=Number(a.bid);}
 else if(a.type==='play'){m.hand=m.hand.filter(c=>c.id!==a.cardId);m.phase='decision';m.turn=null;m.decision={playerId:'me',kind:'discard',title:'Discard 2 cards',options:m.hand.map(c=>({value:c.id,label:c.name,card:c}))};}
 else if(a.type==='choose'){m.phase='trick';m.decision=null;m.result={winnerId:'me',reason:'Fixture trick resolved.'};}
 else if(a.type==='continue'){m.phase='round';if(interaction.timeout)return;ws.close(1012,'Applied action; response lost');return;}
 ws.send(JSON.stringify({type:'state',room}));if(a.requestId&&a.type!=='resume')ws.send(JSON.stringify({type:'ack',requestId:a.requestId}));return;
}
if(a.type!=='create'&&a.type!=='resume')return;const mode=decodeURIComponent((req.headers.cookie||'').match(/fixture=([^;]+)/)?.[1]||a.name||'Winner'),players=[{id:'me',name:'Captain',connected:true,ready:true,bot:false},{id:'bot',name:'Bot 1',connected:false,ready:true,bot:true}];const history=Array.from({length:10},(_,i)=>({round:i+1,results:[{id:'me',bid:2,won:3,bidPoints:-10,bonus:0,total:-10,score:50,breakdown:[]},{id:'bot',bid:1,won:1,bidPoints:20,bonus:10,total:30,score:90,breakdown:[{label:'Yellow 14',points:10}]}]}));const m={matchId:'fixture-'+mode,feedback:[],phase:'play',round:7,dealt:7,trick:6,turn:'me',players:[{id:'me',bid:2,won:3,score:50},{id:'bot',bid:1,won:1,score:90}],hand:[numberCard('black',2)],plays:[],history,revision:1,forcedCardId:null,result:null};
if(mode==='Feedback'){for(let i=1;i<=9;i++)players[i]={id:'p'+i,name:'Captain '+i,connected:true,ready:true,bot:false};m.players=players.map(p=>({id:p.id,bid:2,won:1,score:50}));m.hand=Array.from({length:10},(_,i)=>numberCard('yellow',i+1));const cards=[special('mary'),special('kraken'),special('locker'),special('plank'),numberCard('green',14),special('skull-king'),special('escape'),special('mermaid'),special('stingray')];m.plays=cards.map((card,i)=>({playerId:'p'+(i+1),card}));interaction={room:{code:'OCEAN',hostId:'me',players,expansion:true,match:m},m,rejected:new Set(),feedbackMode:true};}
if(mode==='Interaction'){m.phase='bidding';m.hand=[numberCard('yellow',1),numberCard('green',2),special('wild')];m.dealt=3;m.players[0].bid=null;m.players[0].bidLocked=false;m.players[1].bidLocked=true;interaction={room:{code:'OCEAN',hostId:'me',players,expansion:true,match:m},m,rejected:new Set()};savedInteraction=interaction;}
if(mode==='Timeout'){m.phase='trick';m.result={winnerId:'me',reason:'Timeout recovery test.'};interaction={room:{code:'OCEAN',hostId:'me',players,expansion:true,match:m},m,rejected:new Set(['continue']),timeout:true};savedInteraction=interaction;}
if(mode==='Mary'){m.phase='decision';m.decision={playerId:'me',kind:'mary-card',targetId:'bot',title:'Choose the card bot must play next trick',options:[numberCard('green',9),numberCard('purple',6),numberCard('purple',8),special('whale')].map(c=>({value:c.id,label:c.name,card:c}))};}
if(mode==='Volley'){m.phase='trick';m.hand=[];m.turn=null;m.plays=[{playerId:'me',card:special('volley')},{playerId:'bot',card:numberCard('yellow',14)},{playerId:'me',card:numberCard('black',1)}];m.result={winnerId:'me',reason:'Black trump wins.',removedIds:[]};}
if(mode==='Tigress'){m.plays=[{playerId:'bot',card:special('tigress'),choice:'escape'}];m.leadingPlayerId='bot';}
if(mode==='Winner'){m.phase='finished';m.round=10;m.trick=10;m.hand=[];m.turn=null;m.result={results:history.at(-1).results};}
ws.send(JSON.stringify({type:'welcome',code:'OCEAN',playerId:'me',token:'visual-fixture'}));ws.send(JSON.stringify({type:'state',room:{code:'OCEAN',hostId:'me',players,expansion:true,match:m}}));});});
server.listen(Number(process.env.PORT)||3002,'127.0.0.1',()=>console.log('Visual fixtures:'+server.address().port));
