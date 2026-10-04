/* Save class data in this browser after each operation when retention is enabled. */
const CLASS_DATA_KEY = 'purplecarp.seat-layout.data.v1';
const CLASS_RETENTION_KEY = 'purplecarp.seat-layout.retain.v1';
const CLASS_SETTING_IDS = ['seatRows', 'seatCols', 'podiumPosition', 'homeroomTeacher', 'pdfIncludeDate', 'pdfOrientation', 'avoidPreviousSeat'];
let classStorageErrorShown = false;
let classStorageReady = false;
let applyingClassData = false;
let classStorageReadFailed = false;

function escapeClassText(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
}
function reportClassStorageError(message) {
  if (classStorageErrorShown) return;
  classStorageErrorShown = true;
  alert(message);
}
function classRetentionEnabled() {
  return document.getElementById('retainClassData').checked;
}
function collectClassData() {
  const settings = {};
  CLASS_SETTING_IDS.forEach(id => {
    const input = document.getElementById(id);
    settings[id] = input.type === 'checkbox' ? input.checked : input.value;
  });
  return {format: 'purplecarp-seat-layout', version: 1, savedAt: new Date().toISOString(),
    students: students.map(student => {
      const record = ensureStudentShape(student);
      ['class', 'seat', 'position', 'studentId', 'name', 'officer', 'assistant'].forEach(field => {
        record[field] = String(record[field] ?? '');
      });
      return record;
    }), settings, lockedEmptySeats: [...lockedEmptySeats]};
}
function validateClassData(data) {
  const invalid = () => { throw new Error('本機資料格式或內容不正確。'); };
  if (!data || data.format !== 'purplecarp-seat-layout' || data.version !== 1 ||
      !Array.isArray(data.students) || data.students.length > 5000 ||
      !data.settings || !Array.isArray(data.lockedEmptySeats)) invalid();
  const settings = {};
  CLASS_SETTING_IDS.forEach(id => {
    const value = data.settings[id];
    const input = document.getElementById(id);
    if (input.type === 'checkbox') {
      if (typeof value !== 'boolean') invalid();
    } else if (typeof value !== 'string' || value.length > 1000) invalid();
    if (['seatRows', 'seatCols'].includes(id) &&
        (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 20)) invalid();
    if (input.tagName === 'SELECT' && !Array.from(input.options).some(option => option.value === value)) invalid();
    settings[id] = value;
  });
  const records = data.students.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) invalid();
    const clean = {};
    ['class', 'seat', 'position', 'studentId', 'name', 'officer', 'assistant'].forEach(field => {
      const value = record[field] ?? '';
      if (typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value))) invalid();
      if (String(value).length > 10000) invalid();
      clean[field] = String(value);
    });
    if (!Array.isArray(record.officers) || record.officers.some(value => typeof value !== 'string' || value.length > 1000) ||
        typeof record.prebound !== 'boolean') invalid();
    clean.officers = record.officers;
    clean.prebound = record.prebound;
    return ensureStudentShape(clean);
  });
  // Locks outside a temporarily smaller grid remain available when it grows again.
  if (data.lockedEmptySeats.some(seat => !Number.isInteger(seat) || seat < 1 || seat > 400)) invalid();
  return {students: records, settings, lockedEmptySeats: data.lockedEmptySeats, savedAt: data.savedAt};
}
function applyClassData(data) {
  applyingClassData = true;
  try {
    students = data.students;
    CLASS_SETTING_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input.type === 'checkbox') input.checked = data.settings[id];
      else input.value = data.settings[id];
    });
    lockedEmptySeats.clear();
    data.lockedEmptySeats.forEach(seat => lockedEmptySeats.add(seat));
    selectedStudentIndex = null;
    selectedSeat = null;
    firstSwapSeat = null;
    isSwapMode = false;
    isEmptySeatLockMode = false;
    originalSeatState = null;
    closeRoleAssignmentModal();
    updateSeatCount();
    renderStudentTable();
    updateSwapModeUi();
    updateEmptySeatLockUi();
    updatePdfLayoutNote();
    markExportDirty();
  } finally { applyingClassData = false; }
}
function saveClassDataNow() {
  if (!classStorageReady || applyingClassData || !classRetentionEnabled() || classStorageReadFailed) return;
  try {
    localStorage.setItem(CLASS_DATA_KEY, JSON.stringify(collectClassData()));
    classStorageErrorShown = false;
  } catch (error) {
    reportClassStorageError('無法儲存班級資料，請檢查瀏覽器的網站儲存權限與可用空間。');
  }
}
function scheduleClassDataSave() {
  saveClassDataNow();
}
// Commit table keystrokes too, without rebuilding the focused input. The existing
// change handler still finalizes the edit and adds a blank row when needed.
function saveClassDataInput(event) {
  const input = event.target;
  if (input.closest && input.closest('#studentTableBody')) {
    const handler = input.getAttribute('onchange') || '';
    const match = handler.match(/^updateStudentField\((\d+), '(class|seat|studentId|name|position)', this\.value\)$/);
    if (match && students[Number(match[1])]) {
      const student = students[Number(match[1])];
      const field = match[2];
      student[field] = input.value;
      if (field === 'seat') {
        student.seat = input.value.trim();
        const number = Number(student.seat);
        const rows = Number(document.getElementById('seatRows').value) || 6;
        const cols = Number(document.getElementById('seatCols').value) || 6;
        if (student.seat && Number.isInteger(number) && number >= 1 && number <= rows * cols) {
          student.position = getSeatCoordinateFromIndex(number, cols).label;
        } else if (!student.seat) student.position = '';
      } else if (field === 'position') {
        const position = parsePositionCoordinate(input.value);
        student.position = position ? position.label : input.value.trim();
        if (!position) student.prebound = false;
      }
      renderSeatGrid();
      markExportDirty();
    }
  }
  saveClassDataNow();
}
function initializeClassStorage() {
  let restored = false;
  try {
    const enabled = localStorage.getItem(CLASS_RETENTION_KEY) !== 'false';
    document.getElementById('retainClassData').checked = enabled;
    const raw = enabled ? localStorage.getItem(CLASS_DATA_KEY) : null;
    if (raw) {
      applyClassData(validateClassData(JSON.parse(raw)));
      restored = true;
    }
  } catch (error) {
    classStorageReadFailed = true;
    reportClassStorageError('無法讀取本機班級資料，已暫停自動儲存；可取消勾選後重新勾選，以重新儲存目前資料。');
  }
  classStorageReady = true;
  document.addEventListener('input', saveClassDataInput);
  document.addEventListener('change', saveClassDataNow);
  document.addEventListener('click', saveClassDataNow);
  window.addEventListener('pagehide', saveClassDataNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveClassDataNow();
  });
  return restored;
}
function changeClassDataRetention() {
  try {
    const enabled = classRetentionEnabled();
    if (!enabled) localStorage.removeItem(CLASS_DATA_KEY);
    localStorage.setItem(CLASS_RETENTION_KEY, String(enabled));
    classStorageReadFailed = false;
    classStorageErrorShown = false;
    if (enabled) saveClassDataNow();
  } catch (error) {
    reportClassStorageError('無法變更本機儲存設定，請檢查瀏覽器的網站儲存權限。');
  }
}
