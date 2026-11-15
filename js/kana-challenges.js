(function(root){
  'use strict';
  const data=typeof module!=='undefined' && module.exports ? require('./kana-data.js') : root.KanaData;
  const soundKey=item=>item.hira ? (item.romaji==='wo'?'o':item.romaji) : item.reading;
  function questions(pool,type,count=10,random=Math.random){
    const distinct=(items,key)=>[...new Map(items.map(item=>[key(item),item])).values()];
    return data.shuffle(pool,random).slice(0,count).map(item=>{
      const key=type==='meaning'?entry=>entry.meaning:soundKey;
      const others=distinct(pool.filter(entry=>key(entry)!==key(item)),key);
      return {item,options:data.shuffle([item,...data.shuffle(others,random).slice(0,3)],random)};
    });
  }
  const api={soundKey,questions};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.KanaChallenges=api;
})(typeof window!=='undefined'?window:globalThis);
