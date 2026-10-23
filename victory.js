// Original 6/8 sea-jig: D minor melody, bouncing bass and a final brass chord.
export const VICTORY_MELODY=[
 [74,1],[77,.5],[76,.5],[74,1],[69,1],[72,1],[74,1],
 [77,1],[79,.5],[77,.5],[76,1],[72,1],[69,1],[72,1],
 [74,1],[77,1],[81,1],[79,1],[77,1],[76,1],
 [74,1],[69,1],[72,1],[74,3],
];
export function victoryMarkup({winners,score,localWinner,escape}) {
 const names=winners.map(p=>escape(p.name)).join(' & ');
 return `<section class="victory-hero ${localWinner?'victory-yours':''}" aria-label="Pirate victory celebration"><div class="victory-rays" aria-hidden="true"></div><div class="victory-coins" aria-hidden="true">${Array.from({length:28},(_,i)=>`<i style="--coin:${i};--x:${(i*37)%100}%;--delay:${(i%7)*.12}s;--spin:${i%2?'-':'+'}1"></i>`).join('')}</div><div class="victory-horizon" aria-hidden="true">⚓</div><div class="victory-banner">${localWinner?'THE SEAS ARE YOURS!':'ALL HAIL THE CAPTAIN!'}</div><div class="victory-emblem"><span class="victory-swords" aria-hidden="true">⚔</span><img src="./assets/skull-king.png" alt="" width="1024" height="1536"><span class="victory-medal" aria-hidden="true">★</span></div><p class="victory-salute">${localWinner?'You outwitted the crew. You claimed the treasure.':'A toast to cunning bids and a legendary voyage.'}</p><h3>${names}<span>${winners.length===1?'is the Winner!':'are the Winners!'}</span></h3><div class="victory-plunder"><b>${score}</b><span>POINTS OF GLORY</span></div><p class="victory-cheer">Yo · ho · ho! Raise the flag!</p><button id="victory-music" class="victory-music">♫ Play the victory fanfare</button><a class="victory-ledger-link" href="#final-ledger">The spoils of battle ↓</a></section>`;
}
