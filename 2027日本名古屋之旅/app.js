(() => {
  'use strict';
  const data = window.TRIP_DATA;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = { food:'餐飲・點心', shop:'購物・逛街', sight:'景點・散策', stay:'住宿', transit:'交通・移動' };
  const dayInfo = [
    { date:'2027-01-26', short:'抵達名古屋', title:'初見名古屋，從榮的夜色開始。', area:'桃園 → 中部機場 → 榮', text:'落地後走進城市，在 Oasis 21 留下第一張旅行照片，再以迴轉壽司開啟七日旅程。', tags:['抵達日','Oasis 21','宿・名古屋'] },
    { date:'2027-01-27', short:'熱田・大須', title:'神宮的靜，商店街的熱鬧。', area:'熱田神宮 → 大須 → 榮', text:'先走神宮，再逛大須。壽司、糰子、大福與鰻魚，把名古屋的味道慢慢收集起來。', tags:['神宮散步','大須商店街','宿・名古屋'] },
    { date:'2027-01-28', short:'市場・名古屋城', title:'從市場早味，走進城郭風景。', area:'柳橋 → 四間道 → 名古屋城', text:'串起市場、老街與本丸御殿，晚餐是地圖裡的玄品河豚料理。', tags:['柳橋中央市場','本丸御殿','宿・名古屋'] },
    { date:'2027-01-29', short:'白川鄉・高山', title:'走進山裡，拜訪合掌屋。', area:'名古屋 → 白川鄉 → 高山', text:'由休息站進入白川鄉，在聚落散步、眺望村景、寄張明信片，晚上抵達高山。', tags:['跨城移動','合掌聚落','宿・高山'] },
    { date:'2027-01-30', short:'高山老街', title:'朝市的早晨，老街的日常。', area:'宮川朝市 → 高山陣屋 → 飛驒老街', text:'沿著朝市與老街，把飛驒牛、酒造與咖啡排進一天。日枝神社保留為有空再去的一站。', tags:['宮川朝市','飛驒牛','宿・高山'] },
    { date:'2027-01-31', short:'鐘乳石洞・犬山', title:'從山間出發，走向城下町。', area:'高山 → 犬山 → 名古屋', text:'從高山前往犬山城下町，經過神社、五平餅與昭和橫丁，晚餐回到名古屋；鐘乳石洞是否保留待確認。', tags:['移動較多','犬山城下町','宿・名古屋'] },
    { date:'2027-02-01', short:'最後採買・返程', title:'再逛一會兒，把回憶帶回家。', area:'榮 → 中部機場 → 桃園', text:'在榮商圈完成最後採買，吃過文字燒，準備踏上回家的路。', tags:['榮商圈','返程日','JX839 返程'] }
  ];
  function kind(place, collection = false) {
    const name = place.name;
    if (/飯店|結之湯/.test(name)) return 'stay';
    if (/機場|休息站|Bus Stop/.test(name)) return 'transit';
    if (/餐 \||點心 \|/.test(name) || place.style.includes('0288D1')) return 'food';
    if (place.style.includes('BDBDBD') || /飾品|Lashinbang|業務超市|商圈購物|Aeon|民藝品店/.test(name)) return 'shop';
    return 'sight';
  }
  function displayName(name) {
    return name.replace(/^(午餐|晚餐|點心)\s*\|\s*/, '').replace(/^[^@]{1,12}@/, '').replace(/^☕/, '').replace(/^\(有空再去\)/, '').replace(/oasis21\(頂樓拍照\)/i,'Oasis 21（頂樓拍照）');
  }
  function placeUrl(place) {
    const uncertain = /Kyoshi|德川園/.test(place.name);
    const query = uncertain ? displayName(place.name) + ' 日本' : `${place.lat},${place.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  function placeLink(place) { return `<a class="place-link" href="${escape(placeUrl(place))}" target="_blank" rel="noopener noreferrer" aria-label="在 Google 地圖查看${escape(displayName(place.name))}">↗</a>`; }
  const weekdays = ['日','一','二','三','四','五','六'];
  dayInfo.forEach((day, i) => {
    Object.assign(day, window.NOTION_TRIP[i]);
    const date = new Date(day.date + 'T12:00:00+09:00');
    day.weekday = weekdays[date.getUTCDay()];
    day.label = day.date.slice(5).replace('-', '.') + ' 週' + day.weekday;
    day.places = data.folders[i + 2].places;
  });
  $('#day-tabs').innerHTML = dayInfo.map((day,i) => `<button class="day-tab" id="tab-${i}" role="tab" aria-selected="${i === 0}" aria-controls="day-${i}" tabindex="${i === 0 ? 0 : -1}" type="button" data-day="${i}"><span class="tab-number">0${i+1}</span><span><small>DAY ${i+1} · ${day.label}</small><strong>${day.short}</strong></span></button>`).join('');
  $('#day-panels').innerHTML = dayInfo.map((day,i) => `<article class="day-panel" id="day-${i}" role="tabpanel" aria-labelledby="tab-${i}"${i ? ' hidden' : ''}>
    <header class="day-cover" data-number="0${i+1}"><small>DAY 0${i+1} / ${day.label}</small><h3>${day.title}</h3><p>${day.text}</p><div class="day-summary">${day.tags.map(tag => `<span>${tag}</span>`).join('')}</div></header>
    <div class="day-planning"><div class="checkpoints">${day.checkpoints.map(([time,plan]) => `<div><strong>${escape(time)}</strong><p>${escape(plan)}</p></div>`).join('')}</div><div class="day-meals">${day.meals.map(([meal,name]) => `<p><strong>${meal}</strong>${escape(name)}</p>`).join('')}</div><div class="day-personal"><p><strong>穿搭計畫</strong>${escape(day.outfit)}</p>${day.tasks.length ? `<p><strong>待辦</strong>${day.tasks.map(escape).join('；')}</p>` : ''}${day.booked.length ? `<p><strong>筆記已訂</strong>${day.booked.map(escape).join('、')}</p>` : ''}</div></div>
    <p class="day-intro">${day.area}<br><strong>地圖地點索引</strong> · 依原圖排列，實際動線以當日安排為準</p>
    <ol class="stop-list">${day.places.map((place,j) => {
      const category = kind(place);
      const meal = place.name.match(/^(午餐|晚餐|點心)/)?.[1];
      const optional = place.name.includes('有空再去') || (i === 5 && /鐘乳|茶屋/.test(place.name));
      const original = /@/.test(place.name) ? `<p class="original-note">原圖備註：${escape(place.name)}</p>` : '';
      const description = place.description && !/^https?:/.test(place.description) ? `<p class="original-note">原圖備註：${escape(place.description)}</p>` : '';
      return `<li class="stop" data-kind="${category}"><span class="stop-number">${String(j+1).padStart(2,'0')}</span><div class="stop-body"><div class="stop-meta"><span class="category">${meal || labels[category]}</span>${optional ? '<span>彈性／待確認</span>' : ''}</div><h4>${escape(displayName(place.name))}</h4>${original}${description}</div>${placeLink(place)}</li>`;
    }).join('')}</ol><p class="day-note"><strong>這天的小提醒</strong>${day.note}</p></article>`).join('');
  let currentDay = 0;
  let expanded = false;
  function selectDay(index, focus = false) {
    currentDay = index;
    $$('.day-tab').forEach((tab,i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
    $$('.day-panel').forEach((panel,i) => { panel.hidden = !expanded && i !== index; });
    if (focus) $(`#tab-${index}`).focus();
    if (expanded) $(`#day-${index}`).scrollIntoView({block:'start'});
  }
  $$('.day-tab').forEach(tab => {
    tab.addEventListener('click', () => selectDay(Number(tab.dataset.day)));
    tab.addEventListener('keydown', event => {
      let index = currentDay;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % 7;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index + 6) % 7;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = 6;
      else return;
      event.preventDefault(); selectDay(index, true);
    });
  });
  $('#show-all').addEventListener('click', event => {
    expanded = !expanded;
    event.currentTarget.setAttribute('aria-pressed',String(expanded));
    event.currentTarget.textContent = expanded ? '收合，僅顯示選取日期 ↑' : '展開完整七天 ↓';
    $$('.day-panel').forEach((panel,i) => { panel.hidden = !expanded && i !== currentDay; });
  });
  const collection = data.folders.slice(0,2).flatMap((folder,index) => folder.places.filter(place => !/地標=/.test(place.name)).map(place => ({...place,category:index === 1 ? 'shop' : kind(place,true),group:index === 1 ? '自行安排的購物清單' : '有興趣，有空再去'})));
  $('#collection-grid').innerHTML = collection.map(place => `<article class="wish" data-id="${place.id}" data-category="${place.category}"><div><small>${labels[place.category]} / ${place.group}</small><h3>${escape(displayName(place.name))}</h3>${/@/.test(place.name) ? `<p>原圖：${escape(place.name)}</p>` : ''}${place.description && !/^https?:/.test(place.description) ? `<p>原圖備註（待確認）：${escape(place.description)}</p>` : ''}${/Kyoshi|德川園/.test(place.name) ? '<p class="warning">原地圖定位待確認 · 改以名稱搜尋</p>' : ''}</div>${placeLink(place)}</article>`).join('') + '<p class="empty-results" hidden>沒有符合的地點，試試別的關鍵字或分類。</p>';
  let filter = 'all';
  function applyFilter() {
    const term = $('#search').value.trim().toLocaleLowerCase();
    let count = 0;
    collection.forEach(place => {
      const visible = (filter === 'all' || filter === place.category) && `${place.name} ${place.description}`.toLocaleLowerCase().includes(term);
      $(`[data-id="${place.id}"]`).hidden = !visible;
      if (visible) count++;
    });
    $('#result-count').textContent = `顯示 ${count} / ${collection.length} 個口袋地點`;
    $('.empty-results').hidden = count > 0;
  }
  $$('.filters button').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    $$('.filters button').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
    applyFilter();
  }));
  $('#search').addEventListener('input',applyFilter);applyFilter();
  $('#load-map').addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.title = '2027 日本七日自由行原始 Google 地圖';
    iframe.src = 'https://www.google.com/maps/d/embed?mid=1vJ_7eHqCocVcFSYN0Q1dGkxcBtTLd_U';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    $('#map-stage').replaceChildren(iframe);
  });
  const storageKey = 'chubu-travel-journal-2027-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { saved = {}; }
  if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  if (!Array.isArray(saved.packing)) saved.packing = [];
  if (typeof saved.notes !== 'string') saved.notes = '';
  const packing = ['護照、機票與住宿確認資料','保暖外套、手套、圍巾','防滑好走的鞋與保暖襪','日圓現金、付款卡','網路方案、充電線、行動電源','個人常用物品與盥洗用品','出發前核對班次、訂位與天氣'];
  $('#packing-list').innerHTML = packing.map((item,i) => `<label><input type="checkbox" data-pack="${i}"${saved.packing.includes(i) ? ' checked' : ''}><span>${item}</span></label>`).join('');
  $('#travel-notes').value = saved.notes;
  function storeState() {
    saved = { packing:$$('[data-pack]:checked').map(input => Number(input.dataset.pack)), notes:$('#travel-notes').value };
    try { localStorage.setItem(storageKey,JSON.stringify(saved));$('#save-status').textContent = '已儲存在這個瀏覽器'; }
    catch { $('#save-status').textContent = '此瀏覽器無法儲存；請先複製筆記或列印留存。'; }
    $('#print-notes').textContent = saved.notes || '旅途筆記：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿';
  }
  $$('[data-pack]').forEach(input => input.addEventListener('change',storeState));
  $('#travel-notes').addEventListener('input',storeState);
  $('#print-notes').textContent = saved.notes || '旅途筆記：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿';
  $('#print').addEventListener('click',() => window.print());
})();