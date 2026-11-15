const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {all}=require('../js/kana-data.js');
const {words,categories}=require('../js/n5-data.js');
const {soundKey,questions}=require('../js/kana-challenges.js');

test('160 N5 beginner words have complete, unique entries in eight categories',()=>{
  assert.equal(words.length,160);assert.equal(categories.length,8);
  assert.equal(new Set(words.map(word=>word.id)).size,160);
  assert.equal(new Set(words.map(word=>word.word)).size,160);
  for(const category of categories)assert.equal(words.filter(word=>word.category===category.id).length,20);
  for(const word of words){assert.ok(word.word&&word.meaning);assert.match(word.reading,/^[ぁ-ゖァ-ヶー]+$/);}
});

test('listening options never contain indistinguishable kana homophones',()=>{
  assert.equal(soundKey(all.find(item=>item.hira==='お')),soundKey(all.find(item=>item.hira==='を')));
  assert.equal(soundKey(all.find(item=>item.hira==='じ')),soundKey(all.find(item=>item.hira==='ぢ')));
  assert.equal(soundKey(all.find(item=>item.hira==='ず')),soundKey(all.find(item=>item.hira==='づ')));
  for(const category of ['basic','voiced','contracted'])for(let i=0;i<20;i++){
    const quiz=questions(all.filter(item=>item.category===category),'kana');
    assert.equal(quiz.length,10);assert.equal(new Set(quiz.map(question=>question.item.id)).size,10);
    for(const question of quiz){assert.equal(question.options.length,4);assert.equal(new Set(question.options.map(soundKey)).size,4);assert.equal(question.options.filter(option=>option.id===question.item.id).length,1);}
  }
});

test('N5 meaning and listening challenges have one unambiguous correct answer',()=>{
  for(const category of categories)for(const type of ['meaning','listening']){
    const pool=words.filter(word=>word.category===category.id);
    for(const question of questions(pool,type)){
      assert.equal(question.options.length,4);
      assert.equal(question.options.filter(option=>option.id===question.item.id).length,1);
      assert.equal(new Set(question.options.map(option=>type==='meaning'?option.meaning:option.reading)).size,4);
      assert.ok(question.options.every(option=>option.category===category.id));
    }
  }
});

function audioEnvironment(initialVoices=[{lang:'ja-JP',name:'Japanese'}]){
  let voices=initialVoices;
  const listeners=new Map(),utterances=[];
  const synthesis={getVoices:()=>voices,cancel(){},speak(utterance){utterances.push(utterance);},addEventListener(type,listener){listeners.set(type,listener);},removeEventListener(type){listeners.delete(type);}};
  const context=vm.createContext({window:{speechSynthesis:synthesis,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}},setTimeout,clearTimeout,Error});
  context.SpeechSynthesisUtterance=context.window.SpeechSynthesisUtterance;
  vm.runInContext(fs.readFileSync(require.resolve('../js/kana-audio.js'),'utf8'),context);
  return {audio:context.window.KanaAudio,utterances,setVoices(value){voices=value;listeners.get('voiceschanged')?.();}};
}

test('audio waits for asynchronously loaded Japanese voices and speaks Japanese',async()=>{
  const env=audioEnvironment([]);let started=false;
  const result=env.audio.play('がっこう',{onStart:()=>{started=true;}});
  assert.equal(env.utterances.length,0);
  env.setVoices([{lang:'ja-JP',name:'Japanese'}]);await Promise.resolve();
  assert.equal(env.utterances[0].text,'がっこう');assert.equal(env.utterances[0].lang,'ja-JP');
  env.utterances[0].onstart();assert.equal(started,true);env.utterances[0].onend();assert.equal(await result,true);
});

test('cancelled, interrupted and failed playback cannot count as heard',async()=>{
  const env=audioEnvironment();
  const first=env.audio.play('あ');env.audio.cancel();assert.equal(await first,false);
  const second=env.audio.play('い');env.utterances[1].onerror({error:'interrupted'});assert.equal(await second,false);
  const third=env.audio.play('う');env.utterances[2].onerror({error:'network'});await assert.rejects(third,/發音播放失敗/);
});

test('missing Japanese voice reports actionable error instead of falling back to another language',async()=>{
  const env=audioEnvironment([{lang:'en-US'}]);
  await assert.rejects(env.audio.play('あ'),/找不到日文語音/);
  assert.equal(env.utterances.length,0);
});
