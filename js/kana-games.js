(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const {words,categories}=window.N5Data;
  const {questions}=window.KanaChallenges;
  const audio=window.KanaAudio;
  const progressKey='purplecarp.n5.progress.v1';
  const state={mode:'chart',script:'hira',category:'basic',vocabCategory:'all',vocabMode:'study',known:new Set(),game:null,auto:true,timer:null};
  let audioTicket=0;
  let storageWarning='';
  try{
    const stored=JSON.parse(localStorage.getItem(progressKey)||'[]');
    if(Array.isArray(stored))state.known=new Set(stored.filter(id=>words.some(word=>word.id===id)));
  }catch{storageWarning='無法讀取儲存紀錄，本次進度會暫存在頁面中。';}
  function stop(){
    clearTimeout(state.timer);state.timer=null;state.game=null;audioTicket++;audio.cancel();
  }
  const vocabPool=()=>words.filter(word=>state.vocabCategory==='all'||word.category===state.vocabCategory);
  const gamePool=()=>state.mode==='listen'?window.KanaData.all.filter(item=>item.category===state.category):vocabPool();
  const gameType=()=>state.mode==='listen'?'kana':state.vocabMode;
  const gameHost=()=>$(state.mode==='listen'?'listen-game':'vocab-game');
  const label=item=>item.hira?item[state.script]:item.word;
  const speech=item=>item.hira?(item.hira==='を'?'お':item.hira):item.reading;
  const answerLabel=(item,type)=>type==='meaning'?item.meaning:label(item);
  const explanation=item=>item.hira?label(item)+' · '+item.romaji:item.word+'（'+item.reading+'）· '+item.meaning;
  function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
  function button(text,className,handler){const el=element('button',className,text);el.type='button';el.addEventListener('click',handler);return el;}
  function renderProgress(){
    const items=vocabPool();
    $('vocab-progress').textContent='已熟悉 '+items.filter(item=>state.known.has(item.id)).length+' / '+items.length+' 個單字'+(storageWarning?' · '+storageWarning:' · 進度儲存在這個瀏覽器');
  }
  function renderCards(){
    const query=$('vocab-search').value.trim().normalize('NFKC').toLocaleLowerCase();
    const items=vocabPool().filter(item=>[item.word,item.reading,item.meaning].some(value=>value.normalize('NFKC').toLocaleLowerCase().includes(query)));
    $('vocab-cards').replaceChildren();
    $('vocab-count').textContent='顯示 '+items.length+' 個單字';
    if(!items.length){$('vocab-cards').append(element('p','empty-vocab','沒有符合的單字，試試其他關鍵字或主題。'));return;}
    items.forEach(item=>{
      const card=element('article','vocab-card'+(state.known.has(item.id)?' learned':''));
      const category=element('p','vocab-category',categories.find(category=>category.id===item.category).label);
      const word=element('h4','vocab-word',item.word);word.lang='ja';
      const reading=element('p','vocab-reading',item.reading);reading.lang='ja';
      const meaning=element('p','vocab-meaning',item.meaning);meaning.hidden=$('vocab-hide-meaning').checked;
      const reveal=button('查看中文','text-button',()=>{meaning.hidden=false;reveal.hidden=true;});reveal.hidden=!meaning.hidden;
      const actions=element('div','vocab-card-actions');
      const play=button('♪ 發音','secondary-button',async()=>{
        const ticket=++audioTicket;
        $('vocab-audio-status').textContent='正在準備發音…';
        try{
          const played=await audio.play(item.reading,{onStart:()=>{if(ticket===audioTicket)$('vocab-audio-status').textContent='正在播放：'+item.word;}});
          if(played&&ticket===audioTicket)$('vocab-audio-status').textContent='已播放：'+item.word+'（'+item.reading+'）';
        }catch(error){if(ticket===audioTicket)$('vocab-audio-status').textContent=error.message;}
      });play.setAttribute('aria-label','播放 '+item.word+' 的發音');
      const mark=button(state.known.has(item.id)?'✓ 已熟悉':'標記熟悉','secondary-button',()=>{
        if(state.known.has(item.id))state.known.delete(item.id);else state.known.add(item.id);
        try{localStorage.setItem(progressKey,JSON.stringify([...state.known]));}catch{storageWarning='無法儲存，本次進度僅保留到關閉頁面。';}
        mark.textContent=state.known.has(item.id)?'✓ 已熟悉':'標記熟悉';mark.setAttribute('aria-pressed',state.known.has(item.id));card.classList.toggle('learned',state.known.has(item.id));renderProgress();
      });mark.setAttribute('aria-pressed',state.known.has(item.id));
      actions.append(play,mark);card.append(category,word,reading,meaning,reveal,actions);$('vocab-cards').append(card);
    });
  }
  function renderIntro(){
    const host=gameHost();host.replaceChildren();
    const type=gameType();
    const stage=element('div','challenge-intro');
    stage.append(element('div','sound-symbol',type==='meaning'?'文':'♫'),element('h4','',type==='meaning'?'認得單字，也記得意思。':'耳朵準備好了嗎？'));
    stage.append(element('p','',type==='meaning'?'看日文，直接點選中文意思。每次 10 題。':'開始後會播放日文，點選你聽見的'+(type==='kana'?'假名':'單字')+'，立即知道答案。'));
    const option=element('label','check-label auto-setting');
    const input=document.createElement('input');input.type='checkbox';input.checked=state.auto;
    input.addEventListener('change',()=>{state.auto=input.checked;});option.append(input,document.createTextNode('作答後 2 秒自動下一題（可關閉）'));
    stage.append(option,button('開始挑戰 →','primary-button',()=>start()));
    stage.append(element('p','voice-note',type==='meaning'?'不需播放音訊也能練習。':'請開啟音量；發音需要裝置提供日文語音。'));
    host.append(stage);
  }
  function start(){
    stop();
    state.game={questions:questions(gamePool(),gameType()),type:gameType(),index:0,answers:[],score:0,streak:0,best:0,answered:false,heard:false};
    renderQuestion(true);
  }
  function renderQuestion(autoplay){
    const game=state.game;if(!game)return;
    game.answered=false;game.heard=game.type==='meaning';
    const current=game.questions[game.index],host=gameHost();host.replaceChildren();
    const stage=element('div','challenge-stage');
    const stats=element('div','challenge-stats');
    stats.append(element('span','',`第 ${game.index+1} / ${game.questions.length} 題`),element('strong','game-score',`${game.score} 分`),element('span','game-streak',`連續答對 ${game.streak}`));
    const track=element('div','challenge-track'),fill=element('span');fill.style.width=game.index/game.questions.length*100+'%';track.append(fill);
    stage.append(stats,track);
    const title=element('h4',game.type==='meaning'?'challenge-word':'challenge-prompt',game.type==='meaning'?current.item.word:'聽一聽，選出你聽到的'+(game.type==='kana'?'假名':'單字'));
    if(game.type==='meaning')title.lang='ja';title.tabIndex=-1;stage.append(title);
    const soundControls=element('div','sound-controls');
    const status=element('p','audio-status');status.setAttribute('role','status');
    const options=element('div','quiz-options challenge-options'+(game.type==='kana'?' kana-options':''));options.setAttribute('role','group');options.setAttribute('aria-label',game.type==='meaning'?'選擇中文意思':'選擇聽到的日文');
    const buttons=[];
    const feedback=element('p','challenge-feedback');feedback.setAttribute('role','status');
    const next=button(game.index===game.questions.length-1?'查看結果 →':'下一題 →','primary-button',()=>advance(game));next.hidden=true;
    async function play(rate){
      const ticket=++audioTicket;
      // Replaying suspends automatic advancement so the sound is not cut off.
      clearTimeout(state.timer);state.timer=null;
      if(!game.answered){game.heard=false;buttons.forEach(b=>{b.disabled=true;});}
      status.textContent='正在準備日文語音…';
      try{
        const played=await audio.play(speech(current.item),{rate,onStart:()=>{
          if(state.game!==game||ticket!==audioTicket)return;
          status.textContent='正在播放…';
        }});
        if(state.game!==game||ticket!==audioTicket)return;
        if(played){game.heard=true;if(!game.answered)buttons.forEach(b=>{b.disabled=false;});status.textContent=game.answered?'已重播；準備好後點下一題。':'已播放，請直接點選答案。';}
        else status.textContent='播放已中斷，請再聽一次。';
      }catch(error){if(state.game===game&&ticket===audioTicket){status.textContent=error.message;if(!game.answered){game.heard=false;buttons.forEach(b=>{b.disabled=true;});}}}
    }
    if(game.type!=='meaning'){
      soundControls.append(button('♫ 再聽一次','primary-button',()=>play(.8)),button('慢速播放','secondary-button',()=>play(.55)));stage.append(soundControls,status);
    }
    current.options.forEach(item=>{
      const choice=button(answerLabel(item,game.type),'',()=>{
        if(state.game!==game||game.answered||!game.heard)return;
        game.answered=true;audioTicket++;audio.cancel();
        const correct=item.id===current.item.id;
        game.streak=correct?game.streak+1:0;game.best=Math.max(game.best,game.streak);if(correct)game.score+=100;
        game.answers.push({item:current.item,chosen:item,correct});
        buttons.forEach((b,index)=>{b.disabled=true;if(current.options[index].id===current.item.id)b.classList.add('correct');else if(b===choice)b.classList.add('wrong');});
        stats.querySelector('.game-score').textContent=game.score+' 分';stats.querySelector('.game-streak').textContent='連續答對 '+game.streak;
        feedback.textContent=(correct?'✓ 答對了！ ':'✗ 再記一次：')+explanation(current.item);
        feedback.className='challenge-feedback '+(correct?'answer-correct':'answer-wrong');
        if(game.type!=='meaning')status.textContent='可重播確認讀音。';
        next.hidden=false;next.focus({preventScroll:true});
        if(state.auto)state.timer=setTimeout(()=>advance(game),2000);
      });choice.disabled=!game.heard;
      if(game.type!=='meaning')choice.lang='ja';buttons.push(choice);options.append(choice);
    });
    stage.append(options,feedback,next);
    const autoLabel=element('label','check-label auto-setting'),autoInput=document.createElement('input');autoInput.type='checkbox';autoInput.checked=state.auto;
    autoInput.addEventListener('change',()=>{state.auto=autoInput.checked;clearTimeout(state.timer);state.timer=null;if(state.auto&&game.answered)state.timer=setTimeout(()=>advance(game),2000);});autoLabel.append(autoInput,document.createTextNode('自動下一題'));stage.append(autoLabel);
    host.append(stage);title.focus({preventScroll:true});
    if(game.type!=='meaning'&&autoplay)play(.8);
  }
  function advance(game){
    if(state.game!==game||!game.answered)return;
    clearTimeout(state.timer);state.timer=null;audioTicket++;audio.cancel();
    game.index++;
    if(game.index<game.questions.length)renderQuestion(true);else renderResult(game);
  }
  function renderResult(game){
    const stage=element('div','challenge-stage challenge-results'),missed=game.answers.filter(answer=>!answer.correct);
    const title=element('h4','',missed.length?'挑戰完成，再把這幾個記起來。':'全部答對！耳朵和記憶都很棒。');title.tabIndex=-1;
    stage.append(element('p','eyebrow','CHALLENGE COMPLETE'),title,element('div','quiz-summary',game.score+' 分'),element('p','',`答對 ${game.answers.length-missed.length} / ${game.answers.length} 題 · 最長連續答對 ${game.best} 題`));
    const list=element('ul','review-list');
    missed.forEach(answer=>list.append(element('li','',explanation(answer.item)+'　｜你選了：'+answerLabel(answer.chosen,game.type))));
    stage.append(list,button('再挑戰 10 題 ↻','primary-button',()=>start()));
    gameHost().replaceChildren(stage);title.focus({preventScroll:true});
  }
  function renderVocab(){
    const study=state.vocabMode==='study';$('vocab-study').hidden=!study;$('vocab-game').hidden=study;renderProgress();
    if(study)renderCards();else renderIntro();
  }
  categories.forEach(category=>{const option=document.createElement('option');option.value=category.id;option.textContent=category.label;$('vocab-category').append(option);});
  $('vocab-category').addEventListener('change',()=>{stop();state.vocabCategory=$('vocab-category').value;renderVocab();});
  $('vocab-search').addEventListener('input',renderCards);
  $('vocab-hide-meaning').addEventListener('change',renderCards);
  document.querySelectorAll('[data-vocab-mode]').forEach(tab=>tab.addEventListener('click',()=>{
    stop();state.vocabMode=tab.dataset.vocabMode;document.querySelectorAll('[data-vocab-mode]').forEach(button=>button.setAttribute('aria-pressed',button===tab));renderVocab();
  }));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearTimeout(state.timer);state.timer=null;audioTicket++;audio.cancel();if(state.game&&!state.game.answered&&state.game.type!=='meaning'){state.game.heard=false;gameHost().querySelectorAll('.challenge-options button').forEach(button=>{button.disabled=true;});const status=gameHost().querySelector('.audio-status');if(status)status.textContent='已暫停。回來後請點「再聽一次」。';}}
  });
  window.KanaGames={
    setMode(mode){stop();state.mode=mode;if(mode==='listen')renderIntro();if(mode==='vocab')renderVocab();},
    setScope(script,category){stop();state.script=script;state.category=category;if(state.mode==='listen')renderIntro();}
  };
})();
