/* One Web Audio oscillator, driven by the Classroom clock; no extra animation loop. */
(function(root){
 'use strict';
 class DopplerAudio {
  constructor(){this.context=null;this.oscillator=null;this.gain=null;this.enabled=false;this.request=0;this.targetFrequency=0;this.targetGain=0;}
  async enable(){
   const request=++this.request;
   const Audio=root.AudioContext||root.webkitAudioContext;
   if(!Audio)throw new Error('此瀏覽器不支援聲音合成，請改用新版瀏覽器。');
   if(!this.context){
    this.context=new Audio();this.oscillator=this.context.createOscillator();this.gain=this.context.createGain();
    this.oscillator.type='sine';this.gain.gain.value=0;
    this.oscillator.connect(this.gain);this.gain.connect(this.context.destination);this.oscillator.start();
   }
   await this.context.resume();
   if(request!==this.request)return false;
   if(this.context.state!=='running')throw new Error('聲音尚未啟用，請再次按下開啟聲音。');
   this.enabled=true;return true;
  }
  disable(){++this.request;this.enabled=false;this.silence();}
  silence(){
   this.targetGain=0;
   if(this.gain){const t=this.context.currentTime;this.gain.gain.cancelScheduledValues(t);this.gain.gain.setTargetAtTime(0,t,.008);}
  }
  update(p,s,running,hidden=false){
   if(!this.context)return;
   const hz=p.soundMode==='source'?s.sourceFrequency:s.frequency;
   const type=p.soundType==='ambulance'?'triangle':'sine';
   if(this.oscillator.type!==type)this.oscillator.type=type;
   const level=this.enabled&&p.soundEnabled!==false&&running&&!hidden?p.volume/100*.16:0;
   const t=this.context.currentTime;
   if(hz!==this.targetFrequency){this.targetFrequency=hz;this.oscillator.frequency.setTargetAtTime(hz,t,.012);}
   if(level!==this.targetGain){this.targetGain=level;this.gain.gain.cancelScheduledValues(t);this.gain.gain.setTargetAtTime(level,t,.012);}
  }
 }
 if(typeof module!=='undefined')module.exports=DopplerAudio;else root.DopplerAudio=DopplerAudio;
})(globalThis);
