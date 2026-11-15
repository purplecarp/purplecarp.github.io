(() => {
  'use strict';
  const core = window.ZiweiCore;
  const $ = id => document.getElementById(id);
  const state = { chart: null, horoscope: null, selected: 0, view: 'origin', name: '', input: null, target: '' };
  const viewNames = { origin: '本命盤', yearly: '流年盤', monthly: '流月盤' };
  const topics = { '命宮': '觀察個性、處事方式與自我定位。', '兄弟': '觀察手足與同輩之間的互動。', '夫妻': '觀察伴侶關係與相處模式。', '子女': '觀察子女、晚輩與教養互動。', '財帛': '觀察資源運用與理財傾向。', '疾厄': '傳統上用於觀察身心與生活習慣。', '遷移': '觀察外出、環境變動與對外互動。', '僕役': '觀察朋友、團隊與合作關係。', '官祿': '觀察工作、志向與事業發展方式。', '田宅': '觀察居住、家庭環境與不動產議題。', '福德': '觀察內在感受、休閒與精神生活。', '父母': '觀察長輩、師長與家庭支持。' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatPalace = name => name === '命宮' ? name : `${name}宮`;
  function status(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
  function birthInput() {
    return { calendar: $('calendar').value, date: $('calendar').value === 'solar' ? $('birth-date').value : `${$('lunar-year').value}-${$('lunar-month').value}-${$('lunar-day').value}`, gender: $('gender').value, timeIndex: Number($('birth-time').value), isLeapMonth: $('leap-month').checked };
  }
  function syncCalendar() {
    const lunar = $('calendar').value === 'lunar';
    $('solar-fields').hidden = lunar; $('birth-date').disabled = lunar;
    $('lunar-fields').hidden = !lunar;
    ['lunar-year', 'lunar-month', 'lunar-day', 'leap-month'].forEach(id => { $(id).disabled = !lunar; });
  }
  function submit(isSample = false) {
    try {
      const input = birthInput();
      const chart = core.createChart(window.iztro, input);
      // Commit a complete chart only after validation, preserving the previous result on errors.
      state.chart = chart; state.input = input; state.name = $('person-name').value.trim() || (isSample ? '範例命盤' : '我的命盤');
      state.selected = chart.palaces.findIndex(palace => palace.name === '命宮');
      state.view = 'origin'; state.horoscope = null;
      state.target = core.taipeiToday();
      if (state.target.replaceAll('-', '') < chart.solarDate.split('-').map((v, i) => i ? v.padStart(2, '0') : v).join('')) state.target = chart.solarDate.split('-').map((v, i) => i ? v.padStart(2, '0') : v).join('-');
      $('target-date').value = state.target;
      status('form-status', isSample ? '目前顯示範例：1999/07/02，男，巳時。' : '排盤完成。點選宮位可查看星曜與三方四正。');
      status('chart-status', '');
      $('export').disabled = false; $('print').disabled = false;
      render();
    } catch (error) { status('form-status', error.message, true); }
  }
  function changeView(view, date = $('target-date').value) {
    if (!state.chart) return;
    try {
      const horoscope = view === 'origin' ? null : core.getHoroscope(state.chart, date);
      state.view = view; state.horoscope = horoscope;
      if (horoscope) state.target = date;
      status('chart-status', ''); render();
    } catch (error) {
      $('target-date').value = state.target;
      status('chart-status', `${error.message} 目前保留原命盤。`, true);
    }
  }
  function layers() { return state.view === 'origin' ? [] : state.view === 'yearly' ? ['decadal', 'yearly'] : ['decadal', 'yearly', 'monthly']; }
  function transformation(star) {
    if (state.view === 'origin') return star.mutagen || '';
    const index = state.horoscope[state.view].mutagen.indexOf(star.name);
    return index < 0 ? '' : core.transformations[index];
  }
  function starHTML(star) {
    const mutation = transformation(star);
    return `<span class="star ${escape(star.type)}"><span class="star-name">${escape(star.name)}</span><span class="brightness">${escape(star.brightness || '　')}</span>${mutation ? `<span class="mutagen m${core.transformations.indexOf(mutation)}" title="${viewNames[state.view]}化${mutation}">${mutation}</span>` : ''}</span>`;
  }
  function palaceHTML(palace, index) {
    const [row, col] = core.positions[index];
    const related = core.relatedIndices(state.selected).includes(index);
    const stars = [...palace.majorStars, ...palace.minorStars];
    const periodTags = layers().map(layer => `<span class="period-tag ${layer}">${layer === 'decadal' ? '限' : layer === 'yearly' ? '年' : '月'}·${escape(state.horoscope[layer].palaceNames[index])}</span>`).join('');
    const flowStars = state.view === 'origin' ? '' : (state.horoscope[state.view].stars?.[index] || []).map(star => star.name).join(' ');
    return `<button type="button" class="palace${index === state.selected ? ' selected' : related && $('show-lines').checked ? ' related' : ''}" data-palace="${index}" style="grid-row:${row};grid-column:${col}" aria-pressed="${index === state.selected}" aria-label="${escape(formatPalace(palace.name))}，${palace.heavenlyStem}${palace.earthlyBranch}，${escape(palace.majorStars.map(s => s.name).join('、') || '無主星')}">
      <span class="palace-top"><span>${palace.decadal.range.join('–')} 歲</span>${palace.isBodyPalace ? '<span class="body-badge">身宮</span>' : '<span>本命</span>'}</span>
      <span class="stars">${stars.map(starHTML).join('')}</span>
      <span class="minor-stars">${palace.adjectiveStars.map(star => `<span>${escape(star.name)}</span>`).join('')}</span>
      <span class="extra-stars">${escape([palace.boshi12, palace.jiangqian12, palace.suiqian12].join(' · '))}${flowStars ? `<br>${escape(flowStars)}` : ''}</span>
      ${periodTags ? `<span class="period-tags">${periodTags}</span>` : ''}
      <span class="palace-bottom"><span class="palace-name">${escape(palace.name)}</span><small>${escape(palace.changsheng12)}</small><span>${palace.heavenlyStem}${palace.earthlyBranch}</span></span>
    </button>`;
  }
  function centerHTML() {
    const a = state.chart; const h = state.horoscope;
    const polarity = ['甲', '丙', '戊', '庚', '壬'].includes(a.rawDates.chineseDate.yearly[0]) ? '陽' : '陰';
    const pillars = a.chineseDate.split(' ').map((pillar, index) => `<span class="pillar"><small>${['年柱', '月柱', '日柱', '時柱'][index]}</small><b>${escape(pillar)}</b></span>`).join('');
    const period = h ? `虛歲 ${h.age.nominalAge} · 大限 ${a.palaces[h.decadal.index]?.decadal.range.join('–') || '童限'}<br>流年 ${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}${state.view === 'monthly' ? ` · 流月 ${h.monthly.heavenlyStem}${h.monthly.earthlyBranch}` : ''}<br>${escape(h.lunarDate)}` : '以出生資料排定十二宮<br>點選宮位，展開三方四正';
    return `<div class="chart-center"><span class="center-emblem" aria-hidden="true">✦</span><p class="center-label">紫 微 斗 數 · ${viewNames[state.view]}</p><h3 class="center-name">${escape(state.name)}</h3><div class="center-chips"><span>${polarity}${escape(a.gender)}</span><span>${escape(a.fiveElementsClass)}</span><span>生肖 ${escape(a.zodiac)}</span></div><p class="center-data">國曆 ${escape(a.solarDate)} ${escape(a.time)}<br>農曆 ${escape(a.lunarDate)}<br>命主 ${escape(a.soul)} · 身主 ${escape(a.body)}</p><div class="pillars">${pillars}</div><p class="center-period">${period}</p><p class="center-selected">已選 ${escape(formatPalace(a.palaces[state.selected].name))} · ${a.palaces[state.selected].earthlyBranch}</p></div>`;
  }
  function render() {
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    $('period-controls').hidden = state.view === 'origin';
    $('previous-period').setAttribute('aria-label', state.view === 'monthly' ? '上一個國曆月' : '上一年');
    $('next-period').setAttribute('aria-label', state.view === 'monthly' ? '下一個國曆月' : '下一年');
    if (state.horoscope) $('period-caption').textContent = `農曆 ${state.horoscope.lunarDate}${state.view === 'monthly' ? ' · 箭頭按國曆月切換' : ''}`;
    $('chart-title').textContent = state.view === 'origin' ? '十二宮命盤' : `十二宮 · ${viewNames[state.view]}`;
    $('astrolabe').innerHTML = state.chart.palaces.map(palaceHTML).join('') + centerHTML() + '<svg class="connections" id="connections" aria-hidden="true"></svg>';
    renderDetail(); requestAnimationFrame(drawLines);
  }
  function renderDetail() {
    const p = state.chart.palaces[state.selected];
    const names = stars => stars.map(star => `${star.name}${star.brightness ? `（${star.brightness}）` : ''}`).join('、') || '無';
    const mutagens = [...p.majorStars, ...p.minorStars].filter(star => transformation(star)).map(star => `${star.name}化${transformation(star)}`).join('、') || '無';
    const related = core.relatedIndices(state.selected).slice(1).map((index, i) => `<button type="button" data-related="${index}">${i < 2 ? '三合' : '對宮'} · ${escape(state.chart.palaces[index].name)}</button>`).join('');
    const period = layers().map(layer => `<dt>${layer === 'decadal' ? '大限' : layer === 'yearly' ? '流年' : '流月'}</dt><dd>${escape(formatPalace(state.horoscope[layer].palaceNames[state.selected]))}</dd>`).join('');
    $('palace-detail').innerHTML = `<p class="detail-kicker">本命 · ${p.heavenlyStem}${p.earthlyBranch}${p.isBodyPalace ? ' · 身宮所在' : ''}</p><h3 class="detail-name">${escape(formatPalace(p.name))}</h3><p class="detail-description">${topics[p.name] || ''}</p><dl class="detail-list"><dt>主星</dt><dd>${escape(names(p.majorStars))}${p.majorStars.length ? '' : '主星，可參照對宮。'}</dd><dt>輔煞曜</dt><dd>${escape(names(p.minorStars))}</dd><dt>雜曜</dt><dd>${escape(names(p.adjectiveStars))}</dd><dt>四化</dt><dd>${escape(mutagens)}<br><small>依${viewNames[state.view]}</small></dd><dt>大限</dt><dd>${p.decadal.range.join('–')} 虛歲</dd>${period}</dl><div class="related-list">${related}</div>`;
  }
  function selectPalace(index, focus = false) {
    state.selected = index;
    const related = core.relatedIndices(index);
    document.querySelectorAll('[data-palace]').forEach(button => {
      const i = Number(button.dataset.palace);
      button.classList.toggle('selected', i === index);
      button.classList.toggle('related', i !== index && related.includes(i) && $('show-lines').checked);
      button.setAttribute('aria-pressed', String(i === index));
      if (focus && i === index) button.focus({ preventScroll: true });
    });
    document.querySelector('.center-selected').textContent = `已選 ${formatPalace(state.chart.palaces[index].name)} · ${state.chart.palaces[index].earthlyBranch}`;
    renderDetail(); drawLines();
  }
  function drawLines() {
    const svg = $('connections'); if (!svg || !state.chart) return;
    svg.replaceChildren(); if (!$('show-lines').checked) return;
    const bounds = $('astrolabe').getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const center = document.querySelector('.chart-center').getBoundingClientRect();
    const point = index => {
      const rect = document.querySelector(`[data-palace="${index}"]`).getBoundingClientRect();
      // End points on the inner edge keep lines away from star labels.
      const [row, col] = core.positions[index];
      let x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      if (row === 1) { y = center.top; x = Math.max(center.left, Math.min(center.right, x)); }
      else if (row === 4) { y = center.bottom; x = Math.max(center.left, Math.min(center.right, x)); }
      else { x = col === 1 ? center.left : center.right; }
      return { x: x - bounds.left, y: y - bounds.top };
    };
    const points = core.relatedIndices(state.selected).map(point);
    const makeLine = (a, b) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    svg.innerHTML = makeLine(points[0], points[1]) + makeLine(points[1], points[2]) + makeLine(points[2], points[0]) + makeLine(points[0], points[3]) + points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="2.5"/>`).join('');
  }
  $('calendar').addEventListener('change', syncCalendar);
  $('birth-form').addEventListener('submit', event => { event.preventDefault(); submit(); });
  $('birth-form').addEventListener('input', () => { if (state.chart) status('form-status', '資料已修改，按「開始排盤」更新命盤。'); });
  $('sample').addEventListener('click', () => {
    $('birth-form').reset(); $('person-name').value = ''; syncCalendar(); submit(true);
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
  $('target-date').addEventListener('change', () => changeView(state.view));
  [['previous-period', -1], ['next-period', 1]].forEach(([id, amount]) => $(id).addEventListener('click', () => {
    try { const date = core.shiftDate(state.target, amount, state.view === 'monthly' ? 'month' : 'year'); $('target-date').value = date; changeView(state.view, date); }
    catch (error) { status('chart-status', error.message, true); }
  }));
  $('today').addEventListener('click', () => { $('target-date').value = core.taipeiToday(); changeView(state.view); });
  $('show-lines').addEventListener('change', () => { if (state.chart) selectPalace(state.selected); });
  $('astrolabe').addEventListener('click', event => { const button = event.target.closest('[data-palace]'); if (button) selectPalace(Number(button.dataset.palace)); });
  $('astrolabe').addEventListener('keydown', event => {
    const button = event.target.closest('[data-palace]');
    if (!button || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const [row, col] = core.positions[Number(button.dataset.palace)];
    const dr = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    const dc = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    for (let step = 1; step < 4; step++) { const index = core.positions.findIndex(([r, c]) => r === row + dr * step && c === col + dc * step); if (index >= 0) { selectPalace(index, true); break; } }
  });
  $('palace-detail').addEventListener('click', event => { const button = event.target.closest('[data-related]'); if (button) selectPalace(Number(button.dataset.related), true); });
  $('print').addEventListener('click', () => window.print());
  $('export').addEventListener('click', () => {
    if (!state.chart) return;
    const period = state.horoscope ? { date: state.target, lunarDate: state.horoscope.lunarDate, age: state.horoscope.age, ...Object.fromEntries(layers().map(layer => [layer, state.horoscope[layer]])) } : null;
    const data = { engine: 'iztro 2.6.5', name: state.name, input: state.input, view: state.view, chart: state.chart.toJSON(), period };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `紫微命盤-${state.chart.solarDate}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('chart-status', '命盤資料已匯出為 JSON。');
  });
  window.addEventListener('resize', drawLines);
  window.addEventListener('beforeprint', drawLines);
  window.addEventListener('afterprint', drawLines);
  if (window.ResizeObserver) new ResizeObserver(drawLines).observe($('astrolabe'));
  if (!core || !window.iztro) {
    $('astrolabe').innerHTML = '<p class="loading error">排盤引擎無法載入，請重新整理頁面後再試。</p>';
    status('form-status', '排盤引擎未載入，請重新整理頁面。', true);
  } else { syncCalendar(); submit(true); }
})();
