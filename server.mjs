import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {WebSocketServer} from 'ws';
import * as engine from './engine.js';
import {RoomManager} from './rooms.js';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const rooms=new RoomManager(engine,{dataDir:process.env.DATA_DIR||path.join(root,'.data')});await rooms.load();
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'}).end(req.method==='HEAD'?undefined:'{"status":"ok"}');return;}
 const relative=pathname==='/'?'index.html':pathname.slice(1);
 if(!/^(?:index\.html|[a-z][a-z-]*\.(?:js|css)|manifest\.webmanifest|assets\/[a-zA-Z0-9_./-]+)$/.test(relative)||['rooms.js','engine.js'].includes(relative)||relative.includes('..'))throw Error('Not found');
 const filename=path.resolve(root,relative);if(!filename.startsWith(root)||!types[path.extname(filename)])throw Error('Not found');const info=await stat(filename);if(!info.isFile())throw Error('Not found');
 res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}).end(req.method==='HEAD'?undefined:await readFile(filename));
 }catch(e){res.writeHead(e instanceof URIError?400:404).end('Not found');}
});
const wss=new WebSocketServer({noServer:true,maxPayload:8192});
server.on('upgrade',(req,socket,head)=>{if(new URL(req.url,'http://localhost').pathname!=='/socket'){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
wss.on('connection',ws=>{ws.alive=true;let count=0,window=Date.now();ws.on('pong',()=>ws.alive=true);ws.on('message',data=>{if(Date.now()-window>10000){window=Date.now();count=0;}if(++count>80){ws.close(1008,'Too many actions');return;}try{rooms.handle(ws,JSON.parse(data.toString()));}catch{ws.send(JSON.stringify({type:'error',message:'Invalid message.'}));}});ws.on('close',()=>rooms.disconnect(ws));ws.on('error',()=>{});});
setInterval(()=>rooms.tick(),900).unref();
setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},30000).unref();
server.listen(Number(process.env.PORT)||3001,'0.0.0.0',()=>console.log(`Skull King listening on ${server.address().port}`));
async function shutdown(){wss.close();server.close();await rooms.save();process.exit(0);}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
