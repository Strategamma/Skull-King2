// Snapshot-driven: repeated renders and visibility changes cannot repeat the same alert.
export class TurnAlerts {
  constructor({localId,onAlert,isVisible=()=>true}) {this.localId=localId;this.onAlert=onAlert;this.isVisible=isVisible;this.current=null;this.lastAlert=null;}
  update(snapshot) {this.current=snapshot;this.flush();}
  flush() {
    const s=this.current;
    if(!s||s.phase!=='play'||s.turn!==this.localId||!this.isVisible()||s.key===this.lastAlert) return;
    this.lastAlert=s.key;this.onAlert();
  }
  clear() {this.current=null;}
}
