const {test} = require('node:test');
const assert = require('node:assert/strict');
const {rows,all,shuffle,makeQuestion} = require('../js/kana-data.js');

test('kana sets contain all modern basic, voiced and contracted forms without duplicate IDs',()=>{
  assert.equal(all.filter(x=>x.category==='basic').length,46);
  assert.equal(all.filter(x=>x.category==='voiced').length,25);
  assert.equal(all.filter(x=>x.category==='contracted').length,33);
  assert.equal(new Set(all.map(x=>x.id)).size,104);
  for(const item of all) {
    assert.match(item.hira,/^[ぁ-ゖ]+$/);
    assert.match(item.kata,/^[ァ-ヶ]+$/);
    assert.match(item.romaji,/^[a-z]+$/);
    assert.equal(item.hira.length,item.kata.length);
  }
  assert.deepEqual(rows.find(x=>x.label==='y').items.map(x=>x?.romaji??null),['ya',null,'yu',null,'yo']);
  assert.deepEqual(rows.find(x=>x.label==='w').items.map(x=>x?.romaji??null),['wa',null,null,null,'wo']);
});

test('irregular pronunciations and small kana use correct spelling',()=>{
  const expected={'し':['シ','shi'],'ち':['チ','chi'],'つ':['ツ','tsu'],'ふ':['フ','fu'],'ぢ':['ヂ','ji'],'づ':['ヅ','zu'],'しゃ':['シャ','sha'],'ちゅ':['チュ','chu'],'じょ':['ジョ','jo'],'ぴゃ':['ピャ','pya']};
  for(const [hira,pair] of Object.entries(expected)) {
    const item=all.find(x=>x.hira===hira);
    assert.deepEqual([item.kata,item.romaji],pair);
  }
});

test('each quiz has exactly one correct option, including homophones ji and zu',()=>{
  for(const item of all) for(let repeat=0;repeat<10;repeat++) {
    const question=makeQuestion(item,all.filter(x=>x.category===item.category));
    assert.equal(question.options.length,4);
    assert.equal(new Set(question.options).size,4);
    assert.equal(question.options.filter(x=>x===item.romaji).length,1);
  }
});

test('shuffling preserves original items and question decks contain no repeated kana',()=>{
  const original=all.slice();
  const shuffled=shuffle(all);
  assert.deepEqual(all,original);
  assert.notEqual(shuffled,all);
  assert.deepEqual([...shuffled].sort((a,b)=>a.id.localeCompare(b.id)),[...all].sort((a,b)=>a.id.localeCompare(b.id)));
  assert.equal(new Set(shuffled.slice(0,10).map(x=>x.id)).size,10);
});
