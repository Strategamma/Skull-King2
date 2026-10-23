// Compatibility redirect for old bookmarks. The retired prototype is never served.
import http from 'node:http';
const target=process.env.GAME_URL||'http://localhost:3001/';
http.createServer((_req,res)=>res.writeHead(307,{Location:target,'Cache-Control':'no-store'}).end()).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Open the game at ${target}`));
