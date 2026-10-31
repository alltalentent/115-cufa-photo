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
  const schedule = table_(SHEETS.schedule).records;
  return { people, tasks, schedule, live: Object.fromEntries(live.map(x => [x.key, x.value])) };
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
    writeField_(t, r.__row, 'operator', Session.getActiveUser().getEmail());
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

function changeTaskStatus(taskId, status, notes, checkedItems) {
  const a = requireStaff_();
  if (!['待報到','待拍攝','拍攝中','已完成','需補拍','缺席'].includes(status)) throw new Error('Invalid status');
  const lock = LockService.getDocumentLock(); lock.waitLock(20000);
  try {
    const t = table_(SHEETS.tasks), task = t.records.find(x => x.taskId === taskId);
    if (!task) throw new Error('Task not found');
    writeField_(t,task.__row,'status',status);
    if (notes !== undefined) writeField_(t,task.__row,'notes',String(notes).slice(0,2000));
    if (checkedItems !== undefined) writeField_(t,task.__row,'checkedItems',String(checkedItems).slice(0,1000));
    log_(a,'TASK_STATUS',task.personId,{taskId,status});
    return {taskId,status};
  } finally {lock.releaseLock();}
}
function finishActiveShoot() {
  const a=requireStaff_(), lock=LockService.getDocumentLock(); lock.waitLock(20000);
  try {
    liveSet_('activePersonId','');
    log_(a,'FINISH_ACTIVE','',{});
    return {ok:true,slateRetained:true};
  } finally {lock.releaseLock();}
}
function runSafeWorkflowTest() {
  const a=requireStaff_(), p=table_(SHEETS.people), t=table_(SHEETS.tasks);
  const l=table_(SHEETS.live), ch=table_(SHEETS.checkins), sch=table_(SHEETS.schedule);
  const issues=[], ids=new Set(), taskIds=new Set(), queues=new Set();
  p.records.filter(x=>x.personId).forEach(x=>{
    if(ids.has(x.personId))issues.push('重複人員識別碼 '+x.personId);
    ids.add(x.personId);
    if(x.queueNo){if(queues.has(x.queueNo))issues.push('重複叫號 '+x.queueNo);queues.add(x.queueNo);}
  });
  t.records.filter(x=>x.taskId).forEach(x=>{
    if(taskIds.has(x.taskId))issues.push('重複任務識別碼 '+x.taskId);
    taskIds.add(x.taskId);
    if(!ids.has(x.personId))issues.push('任務無對應學生 '+x.taskId);
  });
  [[p,['personId','name','class','queueNo','checkInStatus']],[t,['taskId','personId','shootType','status','checkedItems','notes']],[l,['key','value','updatedAt','operator']],[ch,['personId','queueNo','checkedAt','operator','consentStatus']],[sch,['slotId','start','end','title','kind']]].forEach(([tab,fields])=>fields.forEach(k=>{if(!tab.keys.includes(k))issues.push(tab.sheet.getName()+' 缺少 '+k)}));
  const next='A'+String(Math.max(0,...Array.from(queues).map(x=>Number(String(x).replace(/^A/,''))).filter(Number.isFinite))+1).padStart(2,'0');
  const candidate=p.records.find(x=>x.personId&&!x.queueNo);
  if(!candidate)issues.push('無可模擬的未報到人員');
  return {ok:issues.length===0,mode:'READ_ONLY',people:ids.size,tasks:taskIds.size,schedule:sch.records.filter(x=>x.slotId).length,existingCheckins:ch.records.filter(x=>x.personId).length,simulated: candidate?{queue:next,checkIn:true,callDoesNotChangeSlate:true,startChangesSlate:true,completeRetainsSlate:true,taskCount:t.records.filter(x=>x.personId===candidate.personId).length}:null,issues,operator:a.email};
}

function doGet() {
  requireStaff_();
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('CUFA PHOTO CONTROL');
}

/**
 * GitHub Pages JSON API.
 * Deploy Apps Script with access appropriate to the production environment.
 * All dashboard reads and writes validate ADMIN_PASSWORD in Script Properties.
 * The frontend uses text/plain POST to avoid browser preflight requests.
 */
function apiUser_(password) {
  const expected=PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if(!expected || typeof password!=='string' || !password || password!==expected) throw new Error('管理密碼錯誤');
  return {email:'管理員',role:'admin'};
}

function apiLog_(actor,action,id,details) {
  table_(SHEETS.logs).sheet.appendRow([new Date(),actor.email,action,id||'',JSON.stringify(details||{})]);
}
function apiLive_(key,value,actor) {
  const t=table_(SHEETS.live),r=t.records.find(x=>x.key===key);
  if (r) {
    writeField_(t,r.__row,'value',value);
    writeField_(t,r.__row,'updatedAt',new Date());
    writeField_(t,r.__row,'operator',actor.email);
  } else t.sheet.appendRow([key,value,new Date(),actor.email]);
}
function apiDispatch_(actor,body) {
  const action=body.action;
  if (action==='dashboard') {
    const people=table_(SHEETS.people).records.filter(x=>x.personId);
    const tasks=table_(SHEETS.tasks).records.filter(x=>x.taskId);
    const schedule=table_(SHEETS.schedule).records.filter(x=>x.slotId);
    const live=table_(SHEETS.live).records;
    return {people,tasks,schedule,live:Object.fromEntries(live.filter(x=>x.key).map(x=>[x.key,x.value]))};
  }
  if (!['checkIn','call','start','finish','task'].includes(action)) throw new Error('Unknown action');
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try {
    const ptab=table_(SHEETS.people),p=ptab.records.find(x=>x.personId===body.personId);
    if (action==='checkIn') {
      if (!p) throw new Error('Person not found');
      if (body.consentStatus!=='已確認') throw new Error('Consent verification required');
      if (p.queueNo) return {queueNo:p.queueNo,alreadyCheckedIn:true};
      const ch=table_(SHEETS.checkins);
      const existing=ch.records.find(x=>x.personId===p.personId && x.queueNo);
      const all=[...ptab.records,...ch.records];
      const max=Math.max(0,...all.map(x=>Number(String(x.queueNo||'').replace(/^A/,''))).filter(x=>Number.isFinite(x)&&x>0));
      const q=existing?existing.queueNo:'A'+String(max+1).padStart(2,'0');
      writeField_(ptab,p.__row,'queueNo',q);
      writeField_(ptab,p.__row,'checkInStatus','已報到');
      if(!existing)ch.sheet.appendRow([p.personId,q,new Date(),actor.email,body.consentStatus]);
      apiLog_(actor,'CHECK_IN',p.personId,{queueNo:q});
      return {queueNo:q};
    }
    if (action==='call'||action==='start') {
      if (!p || !p.queueNo) throw new Error('Not checked in');
      if (action==='call') apiLive_('calledPersonId',p.personId,actor);
      else {apiLive_('slatePersonId',p.personId,actor);apiLive_('activePersonId',p.personId,actor);}
      apiLog_(actor,action.toUpperCase(),p.personId);
      return {ok:true};
    }
    if (action==='finish') {
      apiLive_('activePersonId','',actor);
      apiLog_(actor,'FINISH','');
      return {ok:true,slateRetained:true};
    }
    if (action==='task') {
      if (!['待報到','待拍攝','拍攝中','已完成','需補拍','缺席'].includes(body.status)) throw new Error('Invalid status');
      const t=table_(SHEETS.tasks),task=t.records.find(x=>x.taskId===body.taskId);
      if (!task) throw new Error('Task not found');
      writeField_(t,task.__row,'status',body.status);
      writeField_(t,task.__row,'notes',String(body.notes||'').slice(0,2000));
      writeField_(t,task.__row,'checkedItems',String(body.checkedItems||'').slice(0,1000));
      apiLog_(actor,'TASK_STATUS',task.personId,{taskId:body.taskId,status:body.status});
      return {ok:true};
    }
  } finally {lock.releaseLock();}
}
function doPost(e) {
  let result;
  let requestId='';
  try {
    if (!e || !e.parameter || !e.parameter.payload) throw new Error('Missing form payload');
    const body=JSON.parse(e.parameter.payload);
    requestId=String(body.requestId||'').slice(0,120);
    const actor=apiUser_(body.password);
    const data=body.action==='checkAdminPassword'?{authenticated:true}:apiDispatch_(actor,body);
    result={ok:true,data};
  } catch(err) {
    result={ok:false,error:String(err.message||err)};
  }
  // A form-targeted iframe can communicate across origins using postMessage.
  // Unlike fetch(), it does not depend on Google Apps Script CORS headers.
  const encoded=Utilities.base64EncodeWebSafe(JSON.stringify({requestId,result}));
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body><script>'+
    'parent.postMessage({source:"cufa-apps-script",encoded:"'+encoded+'"},'+
    '"https://alltalentent.github.io");</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
