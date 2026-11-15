const test = require('node:test');
const assert = require('node:assert/strict');
global.self = global;
const iztro = require('../js/vendor/iztro/iztro.min.js');
const core = require('../js/tools/ziwei-core.js');
const sample = { calendar: 'solar', date: '1999-7-2', gender: '男', timeIndex: 5 };
const chart = () => core.createChart(iztro, sample);
test('reference chart: calendar, life/body masters, bureau and major star positions', () => {
  const a = chart();
  assert.equal(a.fiveElementsClass, '水二局');
  assert.equal(a.soul, '巨門'); assert.equal(a.body, '天同');
  assert.equal(a.chineseDate, '己卯 庚午 乙卯 辛巳');
  assert.equal(a.lunarDate, '一九九九年五月十九');
  assert.equal(a.palaces.find(p => p.name === '命宮').earthlyBranch, '丑');
  assert.equal(a.palaces.find(p => p.isBodyPalace).earthlyBranch, '亥');
  assert.equal(a.palaces.find(p => p.majorStars.some(s => s.name === '紫微')).earthlyBranch, '戌');
  assert.equal(a.palaces.flatMap(p => p.majorStars).filter(s => s.type === 'major').length, 14);
});
test('equivalent solar and lunar inputs produce the same chart', () => {
  const lunar = core.createChart(iztro, { ...sample, calendar: 'lunar', date: '1999-5-19' });
  assert.deepEqual(lunar.toJSON(), chart().toJSON());
});
test('rejects invalid dates, nonexistent leap months, invalid gender and time', () => {
  for (const date of ['2025-2-29', '2024-4-31', '', '1899-12-31', '2101-1-1']) assert.throws(() => core.createChart(iztro, { ...sample, date }));
  assert.doesNotThrow(() => core.createChart(iztro, { ...sample, date: '2024-2-29' }));
  assert.throws(() => core.createChart(iztro, { ...sample, calendar: 'lunar', date: '1999-5-19', isLeapMonth: true }));
  assert.throws(() => core.createChart(iztro, { ...sample, calendar: 'lunar', date: '1999-5-31' }));
  for (const timeIndex of [-1, 13, 2.5, NaN]) assert.throws(() => core.createChart(iztro, { ...sample, timeIndex }));
  assert.throws(() => core.createChart(iztro, { ...sample, gender: '' }));
});
test('valid leap month and late Zi hour remain distinct and valid', () => {
  const leap = core.createChart(iztro, { ...sample, calendar: 'lunar', date: '2023-2-1', isLeapMonth: true });
  assert.equal(leap.rawDates.lunarDate.isLeap, true);
  assert.equal(leap.solarDate, '2023-3-22');
  const late = core.createChart(iztro, { ...sample, timeIndex: 12 });
  const nextEarly = core.createChart(iztro, { ...sample, date: '1999-7-3', timeIndex: 0 });
  assert.deepEqual(late.palaces.map(p => p.majorStars.map(s => s.name)), nextEarly.palaces.map(p => p.majorStars.map(s => s.name)));
});
test('reference flow month and year agree with the provided image', () => {
  const h = core.getHoroscope(chart(), '2026-11-15');
  assert.equal(h.age.nominalAge, 28);
  assert.equal(h.yearly.heavenlyStem + h.yearly.earthlyBranch, '丙午');
  assert.equal(h.monthly.heavenlyStem + h.monthly.earthlyBranch, '己亥');
  assert.equal(chart().palaces[h.monthly.index].earthlyBranch, '辰');
  assert.equal(h.yearly.palaceNames.length, 12);
  assert.notDeepEqual(h.monthly.palaceNames, core.getHoroscope(chart(), '2026-12-15').monthly.palaceNames);
  assert.throws(() => core.getHoroscope(chart(), '1999-7-1'));
});
test('birth data changes affect star placement and decadal progression', () => {
  const anotherTime = core.createChart(iztro, { ...sample, timeIndex: 8 });
  assert.notEqual(anotherTime.earthlyBranchOfSoulPalace, chart().earthlyBranchOfSoulPalace);
  const female = core.createChart(iztro, { ...sample, gender: '女' });
  assert.notDeepEqual(female.palaces.map(p => p.decadal.range), chart().palaces.map(p => p.decadal.range));
});
test('month and year navigation clamps month ends and enforces supported years', () => {
  assert.equal(core.shiftDate('2024-1-31', 1, 'month'), '2024-02-29');
  assert.equal(core.shiftDate('2024-2-29', 1, 'year'), '2025-02-28');
  assert.equal(core.shiftDate('2026-1-15', -1, 'month'), '2025-12-15');
  assert.throws(() => core.shiftDate('2100-12-31', 1, 'month'));
});
test('all twelve positions are unique and three-harmony/opposition wrap correctly', () => {
  assert.equal(new Set(core.positions.map(p => p.join(','))).size, 12);
  assert.deepEqual(core.relatedIndices(11), [11, 3, 7, 5]);
  for (let i = 0; i < 12; i++) assert.equal(new Set(core.relatedIndices(i)).size, 4);
});
