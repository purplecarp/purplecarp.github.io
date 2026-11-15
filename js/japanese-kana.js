(() => {
  'use strict';
  const {rows, all, shuffle, makeQuestion} = window.KanaData;
  const $ = id => document.getElementById(id);
  const storageKey = 'purplecarp.kana.progress.v1';
  const categoryNames = {basic:'清音',voiced:'濁音／半濁音',contracted:'拗音'};
  const state = {mode:'chart',script:'hira',category:'basic',known:new Set(),deck:[],position:0,flipped:false,quiz:null,detail:null};
  let statusTimer;
  function announce(message) {
    clearTimeout(statusTimer);
    $('status').textContent = message;
    if ($('kana-dialog').open) $('detail-status').textContent = message;
    statusTimer = setTimeout(() => { $('status').textContent = ''; }, 6000);
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const valid = new Set(all.flatMap(item => ['hira:'+item.id,'kata:'+item.id]));
    if (Array.isArray(saved)) state.known = new Set(saved.filter(key => valid.has(key)));
  } catch { announce('目前無法讀取學習紀錄；仍可正常練習，本次進度會暫存在頁面中。'); }
  const pool = () => all.filter(item => item.category === state.category);
  const key = item => state.script + ':' + item.id;
  const known = item => state.known.has(key(item));
  const scriptName = () => state.script === 'hira' ? '平假名' : '片假名';
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify([...state.known])); }
    catch { announce('瀏覽器無法儲存進度，本次標記僅保留到關閉頁面為止。'); }
  }
  function updateProgress() {
    const items = pool();
    const count = items.filter(known).length;
    $('learned-count').textContent = count;
    $('total-count').textContent = items.length;
    $('progress').setAttribute('aria-valuemax', items.length);
    $('progress').setAttribute('aria-valuenow', count);
    $('progress-fill').style.width = (count / items.length * 100) + '%';
    $('progress-caption').textContent = count === items.length ? '這組都記住了！換一組繼續練習吧。' : scriptName() + '・' + categoryNames[state.category] + '，一步一步累積。';
  }
  function toggleKnown(item) {
    if (known(item)) state.known.delete(key(item)); else state.known.add(key(item));
    save(); updateProgress(); renderChart();
  }
  function renderChart() {
    const chart = $('kana-chart');
    chart.replaceChildren();
    chart.classList.toggle('contracted',state.category === 'contracted');
    $('chart-title').textContent = scriptName() + '・' + categoryNames[state.category];
    const header = document.createElement('div');
    header.className = 'column-heads';
    const columns = state.category === 'contracted' ? ['','ya','yu','yo'] : ['','a','i','u','e','o'];
    columns.forEach(text => { const span = document.createElement('span'); span.textContent=text; header.append(span); });
    chart.append(header);
    rows.filter(row => row.category === state.category).forEach(row => {
      const line = document.createElement('div'); line.className = 'kana-row';
      const label = document.createElement('span'); label.className = 'row-label'; label.textContent = row.label === 'nn' ? 'ん' : row.label; line.append(label);
      row.items.forEach(item => {
        if (!item) { const empty=document.createElement('span'); empty.className='kana-empty'; empty.textContent='—'; empty.setAttribute('aria-hidden','true'); line.append(empty); return; }
        const button=document.createElement('button'); button.type='button'; button.className='kana-cell' + (known(item) ? ' learned' : '');
        button.dataset.kana=item.id;
        button.setAttribute('aria-label',item[state.script] + ($('show-romaji').checked ? '，'+item.romaji : '') + (known(item) ? '，已熟悉' : '') + '，查看詳情');
        const kana=document.createElement('span'); kana.className='kana-glyph'; kana.lang='ja'; kana.textContent=item[state.script]; button.append(kana);
        const romaji=document.createElement('span'); romaji.className='kana-romaji'; romaji.textContent=item.romaji; romaji.hidden=!$('show-romaji').checked; button.append(romaji);
        button.addEventListener('click', () => showDetail(item)); line.append(button);
      });
      chart.append(line);
    });
  }
  function detailNote(item) {
    if (item.hira === 'を') return '「を」作助詞時通常讀作 o；表中以 wo 標示，方便區分「お」。';
    if (item.hira === 'ぢ') return '現代標準日語的「ぢ」通常與「じ」同音，這裡使用 ji 標示。';
    if (item.hira === 'づ') return '現代標準日語的「づ」通常與「ず」同音，這裡使用 zu 標示。';
    if (item.hira === 'は') return '「は」一般讀 ha；作主題助詞時讀 wa。';
    if (item.hira === 'へ') return '「へ」一般讀 he；作方向助詞時讀 e。';
    if (item.hira === 'ん') return '撥音「ん」獨自占一拍，實際發音會隨後面的音而變化。';
    if (item.category === 'contracted') return '拗音由假名加上小寫的「ゃ／ゅ／ょ」組成，兩個字合起來念一拍。';
    return '先記住字形，再跟著發音唸一次；熟悉後，可以把羅馬拼音隱藏。';
  }
  function updateDetail() {
    const item = state.detail;
    $('detail-type').textContent = scriptName() + ' / ' + categoryNames[item.category];
    $('detail-title').textContent = item[state.script];
    $('detail-romaji').textContent = item.romaji;
    $('detail-pair').textContent = '平假名 ' + item.hira + '　↔　片假名 ' + item.kata;
    $('detail-note').textContent = detailNote(item);
    $('mark-known').textContent = known(item) ? '✓ 已熟悉・取消標記' : '標記已熟悉';
    $('mark-known').setAttribute('aria-pressed',known(item));
  }
  function showDetail(item) { state.detail=item; $('detail-status').textContent=''; updateDetail(); $('kana-dialog').showModal(); }
  async function speak() {
    try { await window.KanaAudio.play(state.detail.hira === 'を' ? 'お' : state.detail.hira); }
    catch(error) { announce(error.message); }
  }
  function resetDeck() { state.deck=shuffle(pool()); state.position=0; state.flipped=false; renderFlash(); }
  function renderFlash() {
    const item=state.deck[state.position]; if (!item) return;
    $('flash-position').textContent = (state.position+1) + ' / ' + state.deck.length + '　·　' + scriptName();
    const card=$('flash-card'); card.replaceChildren();
    const glyph=document.createElement('span'); glyph.className=state.flipped ? 'flash-answer' : 'flash-glyph'; glyph.textContent=state.flipped ? item.romaji : item[state.script]; if (!state.flipped) glyph.lang='ja';
    const hint=document.createElement('small'); hint.textContent=state.flipped ? item.hira+' / '+item.kata+'　·　點擊返回正面' : '想好讀音了嗎？點擊翻面';
    card.append(glyph,hint); card.setAttribute('aria-label',state.flipped ? item.romaji+'，點擊返回假名' : item[state.script]+'，點擊查看讀音');
    $('flash-known').textContent=known(item) ? '✓ 已熟悉・取消' : '標記已熟悉';
    $('flash-known').setAttribute('aria-pressed',known(item));
  }
  function moveCard(offset) { state.position=(state.position+offset+state.deck.length)%state.deck.length; state.flipped=false; renderFlash(); }
  function renderQuizIntro() {
    state.quiz=null;
    $('quiz-content').innerHTML='<div class="quiz-stage"><p class="eyebrow">READY WHEN YOU ARE</p><div class="quiz-glyph" aria-hidden="true">よし!</div><h3>準備好，試試你的記憶力。</h3><p>'+scriptName()+'・'+categoryNames[state.category]+' · 隨機 10 題<br>答錯也沒關係，結束後可以再複習。</p><button type="button" class="primary-button" id="start-quiz">開始測驗 →</button></div>';
    $('start-quiz').addEventListener('click',startQuiz);
  }
  function startQuiz() {
    state.quiz={questions:shuffle(pool()).slice(0,10).map(item => makeQuestion(item,pool())),index:0,answers:[]};
    renderQuestion();
  }
  function renderQuestion() {
    const quiz=state.quiz, question=quiz.questions[quiz.index];
    $('quiz-content').innerHTML='<div class="quiz-stage"><p class="practice-position">第 '+(quiz.index+1)+' / '+quiz.questions.length+' 題</p><h4 class="quiz-glyph" id="question-glyph" lang="ja" tabindex="-1">'+question.item[state.script]+'</h4><div class="quiz-options" role="group" aria-label="選擇正確的羅馬拼音"></div><p class="quiz-feedback" id="quiz-feedback" role="status"></p><button type="button" id="next-question" class="primary-button" hidden>'+(quiz.index===quiz.questions.length-1 ? '查看結果 →' : '下一題 →')+'</button></div>';
    const container=$('quiz-content').querySelector('.quiz-options');
    question.options.forEach(option => {
      const button=document.createElement('button'); button.type='button'; button.textContent=option;
      button.addEventListener('click', () => {
        if (quiz.answers.length>quiz.index) return;
        const correct=option===question.item.romaji;
        quiz.answers.push({item:question.item,selected:option,correct});
        container.querySelectorAll('button').forEach(choice => {choice.disabled=true; if(choice.textContent===question.item.romaji) choice.classList.add('correct'); else if(choice===button) choice.classList.add('wrong');});
        $('quiz-feedback').textContent=correct ? '答對了！繼續保持。' : '再記一次：'+question.item[state.script]+' 的讀音是 '+question.item.romaji+'。';
        $('next-question').hidden=false; $('next-question').focus();
      }); container.append(button);
    });
    $('next-question').addEventListener('click', () => {quiz.index++; if(quiz.index<quiz.questions.length) renderQuestion(); else renderResults();});
    $('question-glyph').focus();
  }
  function renderResults() {
    const quiz=state.quiz, mistakes=quiz.answers.filter(answer=>!answer.correct), score=quiz.answers.length-mistakes.length;
    $('quiz-content').innerHTML='<div class="quiz-stage"><p class="eyebrow">PRACTICE COMPLETE</p><h3 id="result-title" tabindex="-1">'+(mistakes.length ? '每次練習，都在進步。' : '太好了，這次全部答對！')+'</h3><div class="quiz-summary">'+score+' <small>/ '+quiz.questions.length+'</small></div><p>'+(mistakes.length ? '把這幾個假名再看一次，下次會更熟悉。' : '可以切換假名或學習範圍，繼續下一個挑戰。')+'</p><ul class="review-list"></ul><button type="button" class="primary-button" id="retry-quiz">再練習 10 題 ↻</button></div>';
    const review=$('quiz-content').querySelector('.review-list');
    mistakes.forEach(answer => { const li=document.createElement('li'); const strong=document.createElement('strong'); strong.lang='ja'; strong.textContent=answer.item[state.script]; li.append(strong,document.createTextNode(answer.item.romaji+'　（你選了 '+answer.selected+'）')); review.append(li); });
    $('retry-quiz').addEventListener('click',startQuiz); $('result-title').focus();
  }
  function changeScope() { window.KanaGames.setScope(state.script,state.category); renderChart(); updateProgress(); resetDeck(); renderQuizIntro(); }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state.mode=button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(tab=>tab.setAttribute('aria-pressed',tab===button));
    ['chart','flash','quiz','listen','vocab'].forEach(mode => {$(mode+'-panel').hidden=mode!==state.mode;});
    $('kana-toolbar').hidden=state.mode==='vocab';
    document.querySelector('.progress-strip').hidden=state.mode==='vocab';
    window.KanaGames.setMode(state.mode);
  }));
  document.querySelectorAll('[data-script]').forEach(button => button.addEventListener('click', () => {
    if(state.script===button.dataset.script) return;
    state.script=button.dataset.script;
    document.querySelectorAll('[data-script]').forEach(tab=>tab.setAttribute('aria-pressed',tab===button));
    changeScope();
  }));
  $('category').addEventListener('change',event=>{state.category=event.target.value;changeScope();});
  $('show-romaji').addEventListener('change',renderChart);
  $('close-dialog').addEventListener('click',()=>$('kana-dialog').close());
  $('kana-dialog').addEventListener('click',event=>{if(event.target===$('kana-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) event.target.close();}});
  $('kana-dialog').addEventListener('close',()=>{window.KanaAudio.cancel(); const trigger=document.querySelector('[data-kana="'+state.detail.id+'"]'); if(trigger) trigger.focus();});
  $('mark-known').addEventListener('click',()=>{toggleKnown(state.detail);updateDetail();renderFlash();});
  $('speak').addEventListener('click',speak);
  $('shuffle').addEventListener('click',()=>{resetDeck();announce('卡片已重新洗牌。');});
  $('flash-card').addEventListener('click',()=>{state.flipped=!state.flipped;renderFlash();});
  $('flash-prev').addEventListener('click',()=>moveCard(-1));
  $('flash-next').addEventListener('click',()=>moveCard(1));
  $('flash-known').addEventListener('click',()=>{toggleKnown(state.deck[state.position]);renderFlash();});
  document.addEventListener('keydown',event=>{if(state.mode!=='flash'||$('kana-dialog').open||['SELECT','INPUT','TEXTAREA'].includes(event.target.tagName)) return; if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();moveCard(event.key==='ArrowLeft' ? -1 : 1);}});
  changeScope();
})();
