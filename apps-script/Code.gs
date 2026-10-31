/**
 * CUFA PHOTO CONTROL — Stage 2: Apps Script hosted UI connectivity.
 * Safe diagnostic only: no student records and no spreadsheet writes.
 */
const CUFA_API_VERSION = 'rebuild-2';
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'json') {
    return json_({ok:true,app:'CUFA PHOTO CONTROL',version:CUFA_API_VERSION,status:'backend-online'});
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CUFA PHOTO CONTROL｜連線測試');
}
function ping() {
  return {ok:true,app:'CUFA PHOTO CONTROL',version:CUFA_API_VERSION,
    status:'script-run-online',message:'Apps Script UI and backend connected'};
}
function doPost(e) {
  try {
    const body=JSON.parse(e && e.postData && e.postData.contents || '{}');
    if(body.action !== 'ping') throw new Error('Only ping enabled during diagnostic');
    return json_({ok:true,action:'ping',version:CUFA_API_VERSION});
  } catch(error) {
    return json_({ok:false,error:String(error.message || error)});
  }
}
