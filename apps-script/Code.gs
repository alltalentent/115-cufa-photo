/** CUFA PHOTO CONTROL — rebuild-3, read-only Sheets integration.
 * No writes. Uses existing spreadsheet-bound Apps Script and ADMIN_PASSWORD script property.
 */
const CUFA_VERSION='rebuild-3.1';
const CUFA_TABS={people:'拍攝學生名單',schedule:'拍攝流程',tasks:'ShootTasks',checkins:'CheckIns',live:'LiveControl'};
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('CUFA PHOTO CONTROL')}
function ping(){return {ok:true,version:CUFA_VERSION,status:'script-run-online'}}
function requireAdmin_(password){
 const expected=PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
 if(!expected)throw new Error('尚未設定 ADMIN_PASSWORD 指令碼屬性');
 if(typeof password!=='string'||password!==expected)throw new Error('管理密碼錯誤');
}
function tableRead_(name){
 const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
 if(!sheet)throw new Error('找不到工作表：'+name);
 const values=sheet.getDataRange().getDisplayValues();
 const header=values.shift()||[];
 return values.filter(row=>row.some(v=>v!=='')).map(row=>Object.fromEntries(header.map((h,i)=>[h,row[i]||''])));
}
function getDashboard(password){
 requireAdmin_(password);
 const people=tableRead_(CUFA_TABS.people);
 const tasks=tableRead_(CUFA_TABS.tasks);
 const schedule=tableRead_(CUFA_TABS.schedule);
 const checkins=tableRead_(CUFA_TABS.checkins);
 const live=tableRead_(CUFA_TABS.live);
 return {version:CUFA_VERSION,people,tasks,schedule,checkins,live};
}

/** Small, read-only diagnostic; avoids transferring entire student dataset. */
function diagnoseDashboard(password){
  requireAdmin_(password);
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('無法取得綁定的 Google 試算表');
  const counts={};
  Object.keys(CUFA_TABS).forEach(function(key){
    const sh=ss.getSheetByName(CUFA_TABS[key]);
    if(!sh)throw new Error('找不到工作表：'+CUFA_TABS[key]);
    counts[key]=Math.max(0,sh.getLastRow()-1);
  });
  return {ok:true,version:CUFA_VERSION,counts:counts};
}
