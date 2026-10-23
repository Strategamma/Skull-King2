import {VICTORY_MELODY} from './victory.js';
// Original synthesized sounds with separate ambience, effects and turn-alert routing.
export class PirateAudio {
  enabled=false;
  alertsEnabled=true;
  context=null;
  ensureContext() {
    if(this.context) return;
    this.context=new AudioContext();
    const ctx=this.context;
    this.master=ctx.createGain();this.master.gain.value=.24;this.master.connect(ctx.destination);
    this.effects=ctx.createGain();this.effects.gain.value=this.enabled?1:0;this.effects.connect(this.master);
    this.alerts=ctx.createGain();this.alerts.connect(this.master);
    this.ambience=ctx.createGain();this.ambience.gain.value=this.enabled?.1:0;this.ambience.connect(this.master);
    const buffer=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate),samples=buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<samples.length;i++){last=(last+(Math.random()*2-1)*.018)/1.018;samples[i]=last*3*(.6+.4*Math.sin(Math.PI*2*i/samples.length));}
    const sea=ctx.createBufferSource(),filter=ctx.createBiquadFilter();sea.buffer=buffer;sea.loop=true;filter.type='lowpass';filter.frequency.value=450;sea.connect(filter).connect(this.ambience);sea.start();
  }
  async unlock() {this.ensureContext();await this.syncVisibility();}
  async toggle() {
    this.ensureContext();this.enabled=!this.enabled;if(!this.enabled)this.stopVictory();
    this.effects.gain.value=this.enabled?1:0;this.ambience.gain.cancelScheduledValues(this.context.currentTime);this.ambience.gain.value=this.enabled?.1:0;
    await this.syncVisibility();if(this.enabled)this.play('bell');return this.enabled;
  }
  async syncVisibility() {
    if(!this.context)return;
    if((this.enabled||this.alertsEnabled)&&!document.hidden) await this.context.resume();else {this.stopVictory();await this.context.suspend();}
  }
  play(kind='click') {
    const alert=kind==='turn';
    if((alert?!this.alertsEnabled:!this.enabled)||this.context?.state!=='running')return;
    if(kind==='victory'){this.playVictory();return;}
    const ctx=this.context,now=ctx.currentTime,bus=alert?this.alerts:this.effects;
    if(['turn','victory','reveal','coins','power'].includes(kind)) {
      const notes={turn:[659,988],victory:[392,494,587,784],reveal:[330,440,660],coins:[1175,1568,1319],power:[196,294,392]}[kind];
      this.ambience.gain.cancelScheduledValues(now);this.ambience.gain.setTargetAtTime(this.enabled?.035:0,now,.02);this.ambience.gain.setTargetAtTime(this.enabled?.1:0,now+.7,.2);
      notes.forEach((f,i)=>this.tone(f,now+i*.11,.65,bus,.16));return;
    }
    if(['swish','deal'].includes(kind)) {
      const length=kind==='deal'?.1:.2,buffer=ctx.createBuffer(1,ctx.sampleRate*length,ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
      const source=ctx.createBufferSource(),gain=ctx.createGain();gain.gain.value=.14;source.buffer=buffer;source.connect(gain).connect(bus);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};return;
    }
    const tones=kind==='bell'?[440,880,1320]:kind==='creak'?[94,141]:kind==='error'?[160,130]:[330*(.98+Math.random()*.04)];
    tones.forEach(f=>this.tone(f,now,kind==='bell'?1.2:.22,bus,.14/tones.length,kind==='creak'?'triangle':'sine'));
  }
  stopVictory() {
    for(const voice of this.victoryVoices||[]) {try {voice.stop();} catch {}}
    this.victoryVoices=[];
    if(this.ambience&&this.context){const now=this.context.currentTime;this.ambience.gain.cancelScheduledValues(now);this.ambience.gain.setTargetAtTime(this.enabled?.1:0,now,.15);}
  }
  playVictory() {
    if(!this.enabled||this.context?.state!=='running')return;
    this.stopVictory();
    const ctx=this.context,start=ctx.currentTime+.03,beat=.22;
    this.ambience.gain.cancelScheduledValues(start);this.ambience.gain.setTargetAtTime(.025,start,.05);this.ambience.gain.setTargetAtTime(.1,start+8.8,.5);
    const note=(midi,time,duration,level,type='triangle')=>{
      this.victoryVoices.push(this.tone(440*2**((midi-69)/12),time,duration,this.effects,level,type));
    };
    let cursor=0;
    for(const [midi,length] of VICTORY_MELODY){note(midi,start+cursor*beat,length*beat*.86,.13);note(midi-12,start+cursor*beat,length*beat*.8,.045,'sawtooth');cursor+=length;}
    for(let pulse=0;pulse<cursor;pulse+=3){const root=pulse<6?38:pulse<12?36:pulse<18?41:38;note(root,start+pulse*beat,.2,.2);note(root+12,start+(pulse+1.5)*beat,.14,.1);}
    const end=start+cursor*beat;
    for(const midi of [38,50,57,62,65,69,74])note(midi,end,1.4,.055,'triangle');
  }
  tone(f,start,duration,bus,level,type='sine') {
    const osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type;osc.frequency.setValueAtTime(f,start);osc.frequency.exponentialRampToValueAtTime(f*.99,start+duration);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(level,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain).connect(bus);osc.start(start);osc.stop(start+duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();};return osc;
  }
}
