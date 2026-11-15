(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ZiweiCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const positions = [[4, 1], [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2]];
  const transformations = ['祿', '權', '科', '忌'];
  function parseDate(value) {
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) throw new Error('請輸入完整日期。');
    const parts = value.split('-').map(Number);
    const [year, month, day] = parts;
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) throw new Error('日期範圍為 1900–2100 年，請確認年月日。');
    return parts;
  }
  function validateSolar(value) {
    const [year, month, day] = parseDate(value);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('此國曆日期不存在，請確認月份與天數。');
    return [year, month, day];
  }
  function createChart(engine, data) {
    if (!engine || !engine.astro) throw new Error('排盤引擎未載入，請重新整理頁面。');
    if (!['男', '女'].includes(data.gender)) throw new Error('請選擇排盤性別。');
    if (!Number.isInteger(data.timeIndex) || data.timeIndex < 0 || data.timeIndex > 12) throw new Error('請選擇有效的出生時辰。');
    if (data.calendar === 'solar') {
      validateSolar(data.date);
      return engine.astro.bySolar(data.date, data.timeIndex, data.gender, true, 'zh-TW');
    }
    if (data.calendar !== 'lunar') throw new Error('請選擇國曆或農曆。');
    const [year, month, day] = parseDate(data.date);
    if (day > 30) throw new Error('農曆日期不能超過三十日。');
    // Check before late-Zi adjustment; the engine silently ignores nonexistent leap months.
    let check;
    try { check = engine.astro.byLunar(data.date, 0, data.gender, !!data.isLeapMonth, true, 'zh-TW'); }
    catch (_) { throw new Error('此農曆日期不存在，請檢查年月日與閏月。'); }
    const lunar = check.rawDates.lunarDate;
    if (lunar.lunarYear !== year || lunar.lunarMonth !== month || lunar.lunarDay !== day || lunar.isLeap !== !!data.isLeapMonth) throw new Error('此農曆日期或閏月不存在，請重新確認。');
    return engine.astro.byLunar(data.date, data.timeIndex, data.gender, !!data.isLeapMonth, true, 'zh-TW');
  }
  function dateNumber(value) { const [y, m, d] = validateSolar(value); return y * 10000 + m * 100 + d; }
  function getHoroscope(chart, date) {
    if (dateNumber(date) < dateNumber(chart.solarDate)) throw new Error('運限日期不可早於出生日期。');
    return chart.horoscope(date);
  }
  function relatedIndices(index) { return [index, (index + 4) % 12, (index + 8) % 12, (index + 6) % 12]; }
  function shiftDate(value, amount, unit) {
    const [year, month, day] = validateSolar(value);
    const first = new Date(Date.UTC(year + (unit === 'year' ? amount : 0), month - 1 + (unit === 'month' ? amount : 0), 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(day, last));
    const result = first.toISOString().slice(0, 10);
    validateSolar(result);
    return result;
  }
  function taipeiToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  return { positions, transformations, parseDate, validateSolar, createChart, getHoroscope, relatedIndices, shiftDate, taipeiToday };
});
