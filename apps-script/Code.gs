/** CUFA PHOTO CONTROL | Production candidate — Apps Script + Sheets.
 * Deploy: Execute as owner, access Anyone; ALL data methods require ADMIN_PASSWORD.
 * Change password to a strong unique value in Script Properties before opening access.
 */
const CUFA_VERSION='2026.11-full';
const TAB={people:'拍攝學生名單',schedule:'拍攝流程',tasks:'ShootTasks',checkins:'CheckIns',live:'LiveControl',logs:'ActivityLogs'};
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('CUFA PHOTO CONTROL').addMetaTag('viewport','width=device-width,initial-scale=1')}
function auth_(password){
 const expected=PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
 if(!expected||typeof password!=='string'||password.length<1||password!==expected)throw Error('管理密碼錯誤或尚未設定');
 return '管理員';
}
function sh_(key){const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('找不到綁定的試算表');const sh=ss.getSheetByName(TAB[key]);if(!sh)throw Error('缺少工作表 '+TAB[key]);return sh}
function rows_(key){
 const sh=sh_(key),last=sh.getLastRow(),cols=sh.getLastColumn();
 if(last<1||cols<1)return [];
 const vals=sh.getRange(1,1,last,cols).getDisplayValues(),header=vals.shift();
 return vals.map((v,i)=>Object.assign({__row:i+2},Object.fromEntries(header.map((h,j)=>[h,v[j]||''])))).filter(x=>header.some(h=>x[h]!==''));
}
function patch_(key,row,fields){
 const sh=sh_(key),headers=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
 Object.keys(fields).forEach(k=>{const col=headers.indexOf(k)+1;if(col)sh.getRange(row,col).setValue(fields[k])});
}
function append_(key,fields){
 const sh=sh_(key),headers=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
 sh.appendRow(headers.map(k=>Object.prototype.hasOwnProperty.call(fields,k)?fields[k]:''));
}
function stamp_(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Taipei','yyyy-MM-dd HH:mm:ss')}
function log_(action,id,details){
 try{const headers=sh_('logs').getRange(1,1,1,sh_('logs').getLastColumn()).getDisplayValues()[0];
 const payload={timestamp:stamp_(),time:stamp_(),action,personId:id,operator:'管理員',details:JSON.stringify(details||{}),detail:JSON.stringify(details||{})};
 sh_('logs').appendRow(headers.map(h=>payload[h]||''))}catch(err){console.warn('log',err)}
}
function getDashboard(password){
 auth_(password);
 const people=rows_('people'),tasks=rows_('tasks'),schedule=rows_('schedule'),checkins=rows_('checkins'),liveRows=rows_('live');
 const live={};liveRows.forEach(r=>live[r.key]=r.value);
 return {version:CUFA_VERSION,people:people.map(({__row,...r})=>r),tasks:tasks.map(({__row,...r})=>r),
 schedule:schedule.map(({__row,...r})=>r),checkins:checkins.map(({__row,...r})=>r),live};
}
function apiAction(password,request){
 auth_(password);
 if(!request||!request.action)throw Error('缺少操作類型');
 const action=String(request.action),id=String(request.personId||'');
 if(!['checkIn','call','start','finish','task','absent','note','clearCall'].includes(action))throw Error('不支援的操作');
 const lock=LockService.getScriptLock();lock.waitLock(15000);
 try{
  const people=rows_('people'),tasks=rows_('tasks'),checkins=rows_('checkins');
  const person=people.find(r=>r.personId===id);
  if(!person&&action!=='clearCall')throw Error('找不到學生');
  const live=rows_('live');
  const setLive=(key,value)=>{
   const r=live.find(x=>x.key===key);
   if(r)patch_('live',r.__row,{value,updatedAt:stamp_(),operator:'管理員'});
   else append_('live',{key,value,updatedAt:stamp_(),operator:'管理員'});
  };
  if(action==='checkIn'){
   if(String(request.consentStatus||'')!=='agreed')throw Error('請先確認已取得報到與拍攝資料使用同意');
   if(checkins.some(r=>r.personId===id))throw Error('此學生已報到');
   const max=Math.max(0,...checkins.map(r=>Number(r.queueNo)||0));
   const queueNo=String(max+1);
   append_('checkins',{personId:id,queueNo,checkedAt:stamp_(),operator:'管理員',consentStatus:'agreed'});
   patch_('people',person.__row,{checkInStatus:'已報到',queueNo});
  }else if(action==='absent'){
   patch_('people',person.__row,{checkInStatus:'未到'});
  }else if(action==='call'){
   if(!checkins.some(r=>r.personId===id))throw Error('請先完成報到');
   setLive('calledPersonId',id);
  }else if(action==='start'){
   if(!checkins.some(r=>r.personId===id))throw Error('請先完成報到');
   setLive('activePersonId',id);setLive('slatePersonId',id);setLive('calledPersonId',id);
   tasks.filter(r=>r.personId===id&&r.status!=='已完成').forEach(r=>patch_('tasks',r.__row,{status:'拍攝中'}));
  }else if(action==='finish'){
   tasks.filter(r=>r.personId===id).forEach(r=>patch_('tasks',r.__row,{status:'已完成'}));
   setLive('activePersonId','');
  }else if(action==='task'){
   const task=tasks.find(r=>r.taskId===String(request.taskId||'')&&r.personId===id);
   if(!task)throw Error('找不到拍攝任務');
   const allowed=['待拍攝','準備中','拍攝中','已完成','暫緩','取消'];
   if(!allowed.includes(request.status))throw Error('無效任務狀態');
   patch_('tasks',task.__row,{status:request.status});
  }else if(action==='note'){
   const task=tasks.find(r=>r.taskId===String(request.taskId||'')&&r.personId===id);
   if(!task)throw Error('找不到拍攝任務');
   patch_('tasks',task.__row,{notes:String(request.notes||'').slice(0,2000)});
  }else if(action==='clearCall')setLive('calledPersonId','');
  log_(action,id,{taskId:request.taskId||'',status:request.status||''});
  return {ok:true,action,updatedAt:stamp_()};
 }finally{lock.releaseLock()}
}
