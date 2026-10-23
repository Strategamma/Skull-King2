export function createBidding(players,dealt) {
  return {players:[...players],dealt,bids:{}};
}
export function lockBid(state,playerId,bid) {
  if(!state.players.includes(playerId)) throw new Error('Unknown seat.');
  if(Object.hasOwn(state.bids,playerId)) throw new Error('Bid is already locked.');
  if(!Number.isInteger(bid)||bid<0||bid>state.dealt) throw new RangeError('Bid must be between zero and cards dealt.');
  return {...state,bids:{...state.bids,[playerId]:bid}};
}
export const waitingFor=state=>state.players.filter(id=>!Object.hasOwn(state.bids,id));
export function visibleBids(state,viewer) {
  const revealed=waitingFor(state).length===0;
  return state.players.map(id=>({id,locked:Object.hasOwn(state.bids,id),bid:revealed||id===viewer?state.bids[id]??null:null}));
}
