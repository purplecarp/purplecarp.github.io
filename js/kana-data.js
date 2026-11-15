(function (root) {
  'use strict';
  const definitions = [
    ['basic','a','あいうえお','a i u e o'],
    ['basic','k','かきくけこ','ka ki ku ke ko'],
    ['basic','s','さしすせそ','sa shi su se so'],
    ['basic','t','たちつてと','ta chi tsu te to'],
    ['basic','n','なにぬねの','na ni nu ne no'],
    ['basic','h','はひふへほ','ha hi fu he ho'],
    ['basic','m','まみむめも','ma mi mu me mo'],
    ['basic','y','や・ゆ・よ','ya - yu - yo'],
    ['basic','r','らりるれろ','ra ri ru re ro'],
    ['basic','w','わ・・・を','wa - - - wo'],
    ['basic','nn','ん・・・・','n - - - -'],
    ['voiced','g','がぎぐげご','ga gi gu ge go'],
    ['voiced','z','ざじずぜぞ','za ji zu ze zo'],
    ['voiced','d','だぢづでど','da ji zu de do'],
    ['voiced','b','ばびぶべぼ','ba bi bu be bo'],
    ['voiced','p','ぱぴぷぺぽ','pa pi pu pe po']
  ];
  const toKatakana = value => Array.from(value, char => String.fromCharCode(char.charCodeAt(0) + 0x60)).join('');
  const rows = definitions.map(([category, label, kana, roman]) => ({category, label,
    items: Array.from(kana, (hira, i) => hira === '・' ? null : ({id:hira, hira, kata:toKatakana(hira), romaji:roman.split(' ')[i], category}))
  }));
  [['き','ky'],['し','sh'],['ち','ch'],['に','ny'],['ひ','hy'],['み','my'],['り','ry'],['ぎ','gy'],['じ','j'],['び','by'],['ぴ','py']].forEach(([base, prefix]) => {
    rows.push({category:'contracted', label:prefix, items:['ゃ','ゅ','ょ'].map((suffix, i) => {
      const hira = base + suffix;
      return {id:hira,hira,kata:toKatakana(hira),romaji:prefix + ['a','u','o'][i],category:'contracted'};
    })});
  });
  const all = rows.flatMap(row => row.items.filter(Boolean));
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i=copy.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
    return copy;
  }
  function makeQuestion(item, pool, random = Math.random) {
    const alternatives = [...new Set(pool.map(entry => entry.romaji))].filter(value => value !== item.romaji);
    return {item, options:shuffle([item.romaji,...shuffle(alternatives,random).slice(0,3)],random)};
  }
  const api = {rows,all,shuffle,makeQuestion};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KanaData = api;
})(typeof window !== 'undefined' ? window : globalThis);
