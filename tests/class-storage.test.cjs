const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'seat-layout.html'), 'utf8');
const main = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('let students = []'));
const storage = fs.readFileSync(path.join(root, 'js/class-storage.js'), 'utf8');
function setup(entries = new Map()) {
  const fields = {};
  const values = {seatRows:'6', seatCols:'6', podiumPosition:'bottom', homeroomTeacher:'', pdfOrientation:'landscape'};
  for (const [id,value] of Object.entries(values)) fields[id] = {value, type:'text', tagName:'INPUT'};
  for (const id of ['pdfIncludeDate','avoidPreviousSeat','retainClassData']) fields[id] = {checked:true,type:'checkbox',tagName:'INPUT'};
  for (const id of ['podiumPosition','pdfOrientation']) Object.assign(fields[id], {tagName:'SELECT', options:[{value:values[id]}]});
  Object.values(fields).forEach(field => field.addEventListener = () => {});
  const alerts = [];
  const listeners = {};
  const context = vm.createContext({console, Blob, URL, setTimeout, clearTimeout,
    document:{getElementById:id=>fields[id], addEventListener:(type,handler)=>{listeners[type]=handler;}}, window:{addEventListener(){}},
    confirm:()=>true, alert:m=>alerts.push(m),
    localStorage:{getItem:key=>entries.get(key)??null, setItem:(key,value)=>entries.set(key,value), removeItem:key=>entries.delete(key)}});
  vm.runInContext(main, context);
  vm.runInContext(storage, context);
  vm.runInContext('renderSeatGrid = renderStudentTable = updateSeatCount = updateSwapModeUi = updateEmptySeatLockUi = updatePdfLayoutNote = updateExportDirtyUi = closeRoleAssignmentModal = () => {};', context);
  return {run:code=>vm.runInContext(code,context), context, fields, entries, alerts, listeners};
}
test('default retention saves full class and restores in a new page', () => {
  const a=setup();
  assert.equal(a.run('initializeClassStorage()'),false);
  assert.equal(a.fields.retainClassData.checked,true);
  a.run("students = [ensureStudentShape({class:'701',name:'Amy',seat:'1',position:'1,1',prebound:true})]; lockedEmptySeats.add(2); saveClassDataNow();");
  assert.equal(a.entries.has('purplecarp.seat-layout.data.v1'),true);
  const b=setup(a.entries);
  assert.equal(b.run('initializeClassStorage()'),true);
  assert.equal(b.run('students[0].name'),'Amy');
  assert.equal(b.run('students[0].prebound'),true);
  assert.equal(b.run('lockedEmptySeats.has(2)'),true);
});
test('unchecking stops future saves and remembers opt-out without deleting screen data', () => {
  const a=setup(); a.run("initializeClassStorage(); students=[ensureStudentShape({name:'Amy'})]; saveClassDataNow(); document.getElementById('retainClassData').checked=false; changeClassDataRetention(); saveClassDataNow();");
  assert.equal(a.entries.has('purplecarp.seat-layout.data.v1'),false);
  assert.equal(a.run('students[0].name'),'Amy');
  const b=setup(a.entries); b.run('initializeClassStorage()');
  assert.equal(b.fields.retainClassData.checked,false);
});
test('invalid stored data is preserved rather than overwritten', () => {
  const a=setup(new Map([['purplecarp.seat-layout.data.v1','broken']]));
  a.run('initializeClassStorage(); saveClassDataNow();');
  assert.equal(a.entries.get('purplecarp.seat-layout.data.v1'),'broken');
});
test('each operation saves immediately and unfinished text edits survive reload', () => {
  const a=setup(); a.run("initializeClassStorage(); students=[ensureStudentShape({name:'Before'})];");
  const input={value:'After',closest:()=>true,getAttribute:()=>"updateStudentField(0, 'name', this.value)"};
  a.listeners.input({target:input});
  assert.equal(JSON.parse(a.entries.get('purplecarp.seat-layout.data.v1')).students[0].name,'After');
  const b=setup(a.entries); b.run('initializeClassStorage()');
  assert.equal(b.run('students[0].name'),'After');
  a.fields.homeroomTeacher.value='Teacher';
  a.listeners.input({target:{}});
  assert.equal(JSON.parse(a.entries.get('purplecarp.seat-layout.data.v1')).settings.homeroomTeacher,'Teacher');
  a.run('lockedEmptySeats.add(3)'); a.listeners.click();
  assert.deepEqual(JSON.parse(a.entries.get('purplecarp.seat-layout.data.v1')).lockedEmptySeats,[3]);
  a.run('students[0].name="Final"; markExportDirty()');
  assert.equal(JSON.parse(a.entries.get('purplecarp.seat-layout.data.v1')).students[0].name,'Final');
});
test('retention section contains only the heading and checked option', () => {
  const section=html.match(/<section[^>]*aria-labelledby="localDataTitle"[^>]*>([\s\S]*?)<\/section>/)[1];
  assert.match(section,/<h3 id="localDataTitle">/);
  assert.match(section,/<input id="retainClassData"[^>]*checked/);
  assert.doesNotMatch(section,/<button|<p|type="file"/);
});
test('storage failure reports one error without repeated alerts', () => {
  const a=setup(); a.run('initializeClassStorage();');
  a.context.localStorage.setItem=()=>{throw new Error('quota');};
  a.run('saveClassDataNow()');
  a.run('saveClassDataNow()');
  assert.equal(a.alerts.length,1);
});
test('student HTML text is escaped for restore rendering', () => {
  const a=setup();
  assert.equal(a.run(`escapeClassText('<img src=x onerror="bad">')`),'&lt;img src=x onerror=&quot;bad&quot;&gt;');
});

test('Excel numeric class and student ID survive saving and reloading', () => {
  const a=setup();
  a.run(`initializeClassStorage(); importXlsxData([
    ['班級','座號','學號','姓名','位置座標'],
    [701,1,123456,'Amy','1,1'],
    [701,2,234567,'Ben','1,2']
  ]);`);
  const saved=JSON.parse(a.entries.get('purplecarp.seat-layout.data.v1'));
  assert.equal(saved.students[0].class,'701');
  assert.equal(saved.students[0].studentId,'123456');
  const b=setup(a.entries);
  assert.equal(b.run('initializeClassStorage()'),true);
  assert.equal(b.run('students[0].class'),'701');
  assert.equal(b.run('students[0].studentId'),'123456');
  assert.equal(b.run('students[1].position'),'1,2');
  assert.equal(b.alerts.length,0);
});
test('previously cached numeric records can still be restored', () => {
  const a=setup(); a.run("initializeClassStorage(); students=[ensureStudentShape({class:701,studentId:123456,name:'Amy'})];");
  const data=JSON.parse(a.run('JSON.stringify(collectClassData())'));
  data.students[0].class=701; data.students[0].studentId=123456;
  a.entries.set('purplecarp.seat-layout.data.v1',JSON.stringify(data));
  const b=setup(a.entries);
  assert.equal(b.run('initializeClassStorage()'),true);
  assert.equal(b.run('students[0].studentId'),'123456');
  assert.equal(b.alerts.length,0);
});
test('shrinking the grid keeps earlier locked seats across reloads', () => {
  const a=setup(); a.run('initializeClassStorage(); lockedEmptySeats.add(36);');
  a.fields.seatRows.value='2'; a.fields.seatCols.value='2';
  a.run('onLayoutConfigChange()');
  const b=setup(a.entries);
  assert.equal(b.run('initializeClassStorage()'),true);
  assert.equal(b.fields.seatRows.value,'2');
  assert.equal(b.run('lockedEmptySeats.has(36)'),true);
  assert.equal(b.alerts.length,0);
});
