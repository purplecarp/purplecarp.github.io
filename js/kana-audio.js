(() => {
  'use strict';
  let token=0, pending=null;
  const synth=window.speechSynthesis;
  const findVoice=()=>synth?.getVoices().find(voice=>/^ja(?:[-_]|$)/i.test(voice.lang));
  function cancel() {
    token++;
    if(pending) pending();
    pending=null;
    synth?.cancel();
  }
  async function play(text,{rate=.8,onStart=()=>{}}={}) {
    cancel();
    const request=token;
    if(!synth || !window.SpeechSynthesisUtterance) throw new Error('這個瀏覽器不支援發音，請使用支援語音的瀏覽器。');
    let voice=findVoice();
    if(!voice) {
      await new Promise(resolve=>{
        const finish=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',check);if(pending===finish)pending=null;resolve();};
        const check=()=>{if(findVoice())finish();};
        const timer=setTimeout(finish,1800);
        pending=finish;synth.addEventListener('voiceschanged',check);check();
      });
      if(request!==token)return false;
      voice=findVoice();
    }
    if(!voice)throw new Error('找不到日文語音。請在裝置安裝日文語音後重試；仍可使用看字選義練習。');
    return new Promise((resolve,reject)=>{
      const utterance=new SpeechSynthesisUtterance(text);
      utterance.lang='ja-JP';utterance.voice=voice;utterance.rate=rate;
      let settled=false;
      const finish=(error,completed=true)=>{
        if(settled)return;settled=true;clearTimeout(timer);
        if(pending===abort)pending=null;
        if(error)reject(error);else resolve(completed&&request===token);
      };
      const abort=()=>finish(undefined,false);
      let timer=setTimeout(()=>{finish(new Error('語音尚未開始，請點「再聽一次」重試並確認音訊設定。'));synth.cancel();},8000);
      pending=abort;
      utterance.onstart=()=>{
        if(request!==token)return;
        clearTimeout(timer);timer=setTimeout(()=>{finish(new Error('語音播放逾時，請再試一次。'));synth.cancel();},15000);
        onStart();
      };
      utterance.onend=()=>finish();
      utterance.onerror=event=>finish(['interrupted','canceled'].includes(event.error)?undefined:new Error('發音播放失敗，請點「再聽一次」重試並檢查日文語音服務。'),false);
      try {synth.speak(utterance);}catch{finish(new Error('無法啟動日文語音，請重試。'));}
    });
  }
  synth?.getVoices();
  window.KanaAudio={play,cancel};
})();
