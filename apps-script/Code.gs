/**
 * CUFA PHOTO CONTROL — Stage 1 connectivity diagnostic
 * Spreadsheet-bound Google Apps Script.
 * Does not read student records or modify any sheet.
 * Do not use this as the production API.
 */
const CUFA_API_VERSION = 'rebuild-1';

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_({ok:true,app:'CUFA PHOTO CONTROL',version:CUFA_API_VERSION,
    status:'backend-online',message:'JSON endpoint is responding'});
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Missing JSON request body');
    }
    const body = JSON.parse(e.postData.contents);
    if (body.action !== 'ping') {
      return json_({ok:false,error:'Only ping is enabled during connectivity testing'});
    }
    return json_({ok:true,action:'ping',version:CUFA_API_VERSION,
      echo:String(body.message || '').slice(0,100)});
  } catch (error) {
    return json_({ok:false,error:String(error.message || error)});
  }
}
