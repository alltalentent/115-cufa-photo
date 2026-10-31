/**
 * CUFA PHOTO CONTROL — Apps Script server
 * Spreadsheet-bound script. Deploy only to authenticated school users.
 * Never publish this as "Anyone" or "Anyone with link".
 */
const SHEETS = {
  people: '拍攝學生名單', tasks: 'ShootTasks', checkins: 'CheckIns',
  live: 'LiveControl', logs: 'ActivityLogs', users: 'Users', schedule: '拍攝流程'
};
function table_(name) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('Missing sheet: ' + name);
  const rows = s.getDataRange().getDisplayValues();
  const keys = rows.shift();
  return { sheet: s, keys, rows, records: rows.map((r, i) => Object.fromEntries([['__row', i + 2], ...keys.map((k, j) => [k, r[j]])])) };
}
function actor_() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  if (!email) throw new Error('Google identity unavailable; deny access');
  const match = table_(SHEETS.users).records.find(x => x.email.toLowerCase() === email && String(x.enabled).toUpperCase() === 'TRUE');
  if (!match) throw new Error('Not authorized');
  return { email, role: match.role };
}
function requireStaff_() {
  const a = actor_();
  if (!['管理員', 'admin', 'staff', '工作人員'].includes(a.role)) throw new Error('Staff access required');
  return a;
}
function writeField_(table, row, field, value) {
  const col = table.keys.indexOf(field) + 1;
  if (!col) throw new Error('Missing field: ' + field);
  table.sheet.getRange(row, col).setValue(value);
}
function log_(a, action, personId, details) {
  table_(SHEETS.logs).sheet.appendRow([new Date(), a.email, action, personId || '', JSON.stringify(details || {})]);
}
function getDashboard() {
  requireStaff_();
  const people = table_(SHEETS.people).records;
  const tasks = table_(SHEETS.tasks).records;
  const live = table_(SHEETS.live).records;
  return { people, tasks, live: Object.fromEntries(live.map(x => [x.key, x.value])) };
}
function checkIn(personId, consentStatus) {
  const a = requireStaff_();
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const t = table_(SHEETS.people);
    const p = t.records.find(x => x.personId === personId);
    if (!p) throw new Error('Person not found');
    if (p.queueNo) return { queueNo: p.queueNo, alreadyCheckedIn: true };
    if (consentStatus !== '已確認') throw new Error('Consent must be verified');
    const used = t.records.map(x => Number(String(x.queueNo).replace(/^A/, ''))).filter(Number.isFinite);
    const queueNo = 'A' + String(Math.max(0, ...used) + 1).padStart(2, '0');
    writeField_(t, p.__row, 'queueNo', queueNo);
    writeField_(t, p.__row, 'checkInStatus', '已報到');
    table_(SHEETS.checkins).sheet.appendRow([personId, queueNo, new Date(), a.email, consentStatus]);
    log_(a, 'CHECK_IN', personId, { queueNo });
    return { queueNo };
  } finally { lock.releaseLock(); }
}
function liveSet_(key, value) {
  const t = table_(SHEETS.live);
  const r = t.records.find(x => x.key === key);
  if (r) {
    writeField_(t, r.__row, 'value', value);
    writeField_(t, r.__row, 'updatedAt', new Date());
  } else t.sheet.appendRow([key, value, new Date(), Session.getActiveUser().getEmail()]);
}
function callPerson(personId) {
  const a = requireStaff_();
  const p = table_(SHEETS.people).records.find(x => x.personId === personId);
  if (!p || !p.queueNo) throw new Error('Not checked in');
  liveSet_('calledPersonId', personId);
  log_(a, 'CALL', personId);
  return { calledPersonId: personId };
}
function startShoot(personId) {
  const a = requireStaff_();
  const p = table_(SHEETS.people).records.find(x => x.personId === personId);
  if (!p || !p.queueNo) throw new Error('Not checked in');
  // Only START changes the slate. CALL and COMPLETE must not change it.
  liveSet_('slatePersonId', personId);
  liveSet_('activePersonId', personId);
  log_(a, 'START', personId);
  return { slatePersonId: personId };
}
function completeShoot(taskId) {
  const a = requireStaff_();
  const t = table_(SHEETS.tasks);
  const task = t.records.find(x => x.taskId === taskId);
  if (!task) throw new Error('Task not found');
  writeField_(t, task.__row, 'status', '已完成');
  log_(a, 'COMPLETE', task.personId, { taskId });
  return { taskId, status: '已完成' };
}
/**
 * Non-destructive workflow simulation.
 * Reads live records but never writes to Students, tasks, live, logs or check-ins.
 * Use this before testing the real check-in workflow.
 */
function runSafeWorkflowTest() {
  const a = requireStaff_();
  const p = table_(SHEETS.people);
  const t = table_(SHEETS.tasks);
  const live = table_(SHEETS.live);
  const checkins = table_(SHEETS.checkins);
  const problems = [];
  const personIds = new Set();
  p.records.filter(x => x.personId).forEach(x => {
    if (personIds.has(x.personId)) problems.push('重複 personId: ' + x.personId);
    personIds.add(x.personId);
  });
  t.records.filter(x => x.taskId).forEach(x => {
    if (!personIds.has(x.personId)) problems.push('拍攝任務找不到人員: ' + x.taskId);
  });
  const queueNumbers = p.records.map(x => x.queueNo).filter(Boolean);
  if (new Set(queueNumbers).size !== queueNumbers.length) problems.push('重複報到號碼');
  const nextNumber = 'A' + String(Math.max(0, ...queueNumbers.map(x => Number(String(x).replace(/^A/, ''))).filter(Number.isFinite)) + 1).padStart(2, '0');
  const candidate = p.records.find(x => x.personId && !x.queueNo);
  if (!candidate) problems.push('沒有未報到人員可供模擬');
  const candidateTasks = candidate ? t.records.filter(x => x.personId === candidate.personId) : [];
  if (candidate && !candidateTasks.length) problems.push('模擬人員沒有拍攝任務');
  const requiredPeople = ['personId','name','class','queueNo','checkInStatus'];
  const requiredTasks = ['taskId','personId','shootType','status'];
  const requiredLive = ['key','value','updatedAt','operator'];
  const requiredCheckins = ['personId','queueNo','checkedAt','operator','consentStatus'];
  [[p,requiredPeople],[t,requiredTasks],[live,requiredLive],[checkins,requiredCheckins]].forEach(([table,fields]) => fields.forEach(k => {
    if (!table.keys.includes(k)) problems.push('缺少欄位: ' + table.sheet.getName() + '.' + k);
  }));
  const simulated = candidate ? {
    checkIn: { personId: candidate.personId, queueNo: nextNumber, status: '已報到' },
    call: { calledPersonId: candidate.personId, slateUnchanged: true },
    start: { activePersonId: candidate.personId, slatePersonId: candidate.personId },
    complete: { taskIds: candidateTasks.map(x => x.taskId), slateRemains: candidate.personId }
  } : null;
  return {
    ok: problems.length === 0, mode: 'READ_ONLY_SIMULATION', actor: a.email,
    peopleCount: p.records.filter(x => x.personId).length,
    taskCount: t.records.filter(x => x.taskId).length,
    existingCheckIns: checkins.records.filter(x => x.personId).length,
    simulated, problems,
    note: '沒有寫入任何試算表資料，報到號碼僅為模擬預測'
  };
}
function doGet() {
  requireStaff_();
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('CUFA PHOTO CONTROL');
}
