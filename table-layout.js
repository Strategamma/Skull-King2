export function tableLayout(players, localId) {
  if (players.length < 2 || players.length > 10) throw new RangeError('Tables require 2–10 players.');
  const localIndex = players.findIndex(p => p.id === localId);
  if (localIndex < 0) throw new Error('Local player must have a seat.');
  return {
    columns: Math.ceil(players.length / 2),
    seats: players.map((player, index) => {
      const slot=(index-localIndex+players.length)%players.length;
      if(players.length===3){const x=slot===0?50:slot===1?25:75;return {id:player.id,x,y:slot===0?92:25,playX:x,playY:50,edge:slot===0?'cap':slot===1?'left':'right'};}
      if(players.length===4){const points=[{x:50,y:92,edge:'cap'},{x:25,y:50,edge:'left'},{x:50,y:8,edge:'cap'},{x:75,y:50,edge:'right'}];return {id:player.id,...points[slot],playX:50,playY:50};}
      if(players.length>=5){
        const left=Math.ceil((players.length-2)/2),right=players.length-2-left;
        if(slot===0) return {id:player.id,x:50,y:92,playX:50,playY:73};
        if(slot===left+1) return {id:player.id,x:50,y:8,playX:50,playY:27};
        const onLeft=slot<=left,position=onLeft?slot-1:slot-left-2,total=onLeft?left:right;
        const y=total===1?50:onLeft?76-position*52/(total-1):24+position*52/(total-1);
        return {id:player.id,x:onLeft?25:75,y,playX:onLeft?34:66,playY:y,edge:onLeft?'left':'right'};
      }
      // Keep the local seat at the bottom as the table grows or shrinks.
      const angle = Math.PI / 2 + (index - localIndex) * 2 * Math.PI / players.length;
      return { id: player.id, x: 50 + 43 * Math.cos(angle), y: 50 + 42 * Math.sin(angle), playX:50+25*Math.cos(angle), playY:50+26*Math.sin(angle) };
    }),
  };
}
