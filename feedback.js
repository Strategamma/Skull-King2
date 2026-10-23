// Pure snapshot diff: baseline on initial connection/resume, never replay missed effects.
export class FeedbackTracker {
 constructor(){this.previous=null;}
 reset(){this.previous=null;}
 update(room,{quiet=false}={}){
  const before=this.previous;this.previous=structuredClone(room);
  if(!before||before.code!==room.code||quiet)return [];
  const events=[],old=before.match,m=room.match;
  if(before.hostId!==room.hostId&&room.hostId)events.push({kind:'host',actorId:room.hostId});
  for(const p of room.players){const prior=before.players.find(x=>x.id===p.id);if(!prior)continue;
   if(p.bot&&(!prior.bot||!prior.permanentBot&&p.permanentBot))events.push({kind:'takeover',actorId:p.id,permanent:!!p.permanentBot});
   else if(prior.bot&&!p.bot&&p.connected)events.push({kind:'returned',actorId:p.id});
   else if(prior.connected&&!p.connected&&!p.bot)events.push({kind:'disconnected',actorId:p.id});
   else if(!prior.connected&&p.connected)events.push({kind:'returned',actorId:p.id});
  }
  for(const p of before.players)if(!room.players.some(now=>now.id===p.id))events.push({kind:'removed',actorId:p.id});
  if(!m)return events;
  const same=old&&old.matchId&&old.matchId===m.matchId;
  if(!same){if(m.phase==='bidding')events.push({kind:'deal'});return events;}
  if(m.round!==old.round){events.push({kind:'deal'});return events;}
  const trick=m.trick===old.trick;
  const seen=new Set(trick?(old.plays||[]).map(p=>p.card.id):[]);
  for(const p of m.plays||[])if(!seen.has(p.card.id))events.push({kind:'play',cardId:p.card.id});
  if(old.phase==='bidding'&&m.phase!=='bidding')events.push({kind:'reveal'});
  if(trick&&m.leadingPlayerId&&m.leadingPlayerId!==old.leadingPlayerId)events.push({kind:'leader',actorId:m.leadingPlayerId});
  const held=new Set((old.hand||[]).map(c=>c.id));
  for(const c of m.hand||[])if(!held.has(c.id))events.push({kind:'draw',cardId:c.id});
  const priorIds=new Set((old.feedback||[]).map(e=>e.id));
  for(const e of m.feedback||[])if(!priorIds.has(e.id))events.push({...e,kind:'outcome',effect:e.kind});
  if(m.phase==='round'&&old.phase!=='round')events.push({kind:'round'});
  if(m.phase==='finished'&&old.phase!=='finished')events.push({kind:'finished'});
  return events;
 }
}
export function outcomeText(event,name){
 if(event.kind==='host')return `${name(event.actorId)} is now captain.`;
 if(event.kind==='takeover')return `${name(event.actorId)} is now played by a bot${event.permanent?' permanently':'; the human can still reclaim this seat'}.`;
 if(event.kind==='removed')return `${name(event.actorId)} left or was removed from the crew.`;
 if(event.kind==='returned')return `${name(event.actorId)} returned to the table.`;
 if(event.kind==='disconnected')return `${name(event.actorId)} disconnected. Their seat countdown shows the remaining grace period.`;
 return event.text?`${event.actorId?name(event.actorId)+': ':''}${event.text}${event.targetId?' '+name(event.targetId)+' leads next.':''}`:'';
}
