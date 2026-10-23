// Local visual fixtures only; never copied to game/ or deployed.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {WebSocketServer} from '../../game/node_modules/ws/wrapper.mjs';
import {SPECIALS,numberCard} from '../../game/cards.js';
const special=id=>({...SPECIALS.find(c=>c.id===id),id});
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.searchParams.has('state'))res.setHeader('Set-Cookie',`fixture=${encodeURIComponent(url.searchParams.get('state'))}; SameSite=Lax; Path=/`);const relative=url.pathname;const file=path.resolve('game','.'+(relative==='/'?'/index.html':relative));const body=await readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.webmanifest')?'application/manifest+json':'image/'+(file.endsWith('.jpg')?'jpeg':'png')});res.end(body);}catch{res.writeHead(404).end();}});
const wss=new WebSocketServer({server});
wss.on('connection',(ws,req)=>ws.on('message',raw=>{const a=JSON.parse(raw);if(a.type!=='create'&&a.type!=='resume')return;const mode=decodeURIComponent((req.headers.cookie||'').match(/fixture=([^;]+)/)?.[1]||a.name||'Winner'),players=[{id:'me',name:'Captain',connected:true,ready:true,bot:false},{id:'bot',name:'Bot 1',connected:false,ready:true,bot:true}];const history=Array.from({length:10},(_,i)=>({round:i+1,results:[{id:'me',bid:2,won:3,bidPoints:-10,bonus:0,total:-10,score:50,breakdown:[]},{id:'bot',bid:1,won:1,bidPoints:20,bonus:10,total:30,score:90,breakdown:[{label:'Yellow 14',points:10}]}]}));const m={phase:'play',round:7,dealt:7,trick:6,turn:'me',players:[{id:'me',bid:2,won:3,score:50},{id:'bot',bid:1,won:1,score:90}],hand:[numberCard('black',2)],plays:[],history,revision:1,forcedCardId:null,result:null};
if(mode==='Mary'){m.phase='decision';m.decision={playerId:'me',kind:'mary-card',targetId:'bot',title:'Choose the card bot must play next trick',options:[numberCard('green',9),numberCard('purple',6),numberCard('purple',8),special('whale')].map(c=>({value:c.id,label:c.name,card:c}))};}
if(mode==='Volley'){m.phase='trick';m.hand=[];m.turn=null;m.plays=[{playerId:'me',card:special('volley')},{playerId:'bot',card:numberCard('yellow',14)},{playerId:'me',card:numberCard('black',1)}];m.result={winnerId:'me',reason:'Black trump wins.',removedIds:[]};}
if(mode==='Tigress'){m.plays=[{playerId:'bot',card:special('tigress'),choice:'escape'}];m.leadingPlayerId='bot';}
if(mode==='Winner'){m.phase='finished';m.round=10;m.trick=10;m.hand=[];m.turn=null;m.result={results:history.at(-1).results};}
ws.send(JSON.stringify({type:'welcome',code:'OCEAN',playerId:'me',token:'visual-fixture'}));ws.send(JSON.stringify({type:'state',room:{code:'OCEAN',hostId:'me',players,expansion:true,match:m}}));}));
server.listen(3002,'127.0.0.1',()=>console.log('Visual fixtures:3002'));
