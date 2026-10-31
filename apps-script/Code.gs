/** CUFA PHOTO CONTROL — rebuild baseline.
 * Google Sheets remains the database. No existing sheet is modified here.
 * Backend routes and permissions will be implemented from the approved specification.
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok:false,error:'SYSTEM_REBUILDING'}))
    .setMimeType(ContentService.MimeType.JSON);
}
function doPost() {
  return ContentService.createTextOutput(JSON.stringify({ok:false,error:'SYSTEM_REBUILDING'}))
    .setMimeType(ContentService.MimeType.JSON);
}
