import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const frontend=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const backend=readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
const proxy=readFileSync(new URL('../worker/proxy.js',import.meta.url),'utf8');
const config=readFileSync(new URL('../config.js',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
test('GitHub serves full photo UI, not Apps Script redirect',()=>{for(const s of ['現場報到','叫號看板','電子試鏡單','拍攝流程'])assert.match(frontend,new RegExp(s));assert.doesNotMatch(frontend,/google\.script\.run|<iframe/)});
test('Use identical uniform-style POST JSON contract',()=>{assert.match(frontend,/fetch\(url/);assert.match(frontend,/text\/plain;charset=utf-8/);assert.match(frontend,/JSON\.stringify\(payload\)/);assert.match(backend,/function doPost\(e\)/);assert.match(backend,/ContentService\.MimeType\.JSON/)});
test('All backend data actions require password',()=>{assert.match(backend,/function getDashboard\(password\)/);assert.match(backend,/function apiAction\(password,request\)/);assert.match(backend,/auth_\(password\)/)});
test('Call action does not change slate',()=>{const branch=backend.slice(backend.indexOf("}else if(action==='call')"),backend.indexOf("}else if(action==='start')"));assert.match(branch,/calledPersonId/);assert.doesNotMatch(branch,/slatePersonId/)});
test('Public static code contains no student data or secret',()=>{assert.doesNotMatch(frontend,/1nq1d8fEzDIfY4othTMXa79tsXy6OsICzjAlN5-K9UEQ/);assert.doesNotMatch(config,/ADMIN_PASSWORD|1nq1d8fEzDIfY4othTMXa79tsXy6OsICzjAlN5-K9UEQ/)});
test('Deployment only publishes frontend files',()=>{assert.match(workflow,/cp index\.html config\.js public\//)});


test('Frontend embeds latest confirmed Apps Script endpoint',()=>{assert.match(frontend,/AKfycbypwBfQXgB4eUmfK2qBmlKjYHvcr1V7m822Q8kf6G3AGwsSu0q5m3BbQDONAzrDTl0Z/);assert.doesNotMatch(frontend,/CUFA_CONFIG\?\.proxyUrl/)});
test('Apps Script needs only Code.gs',()=>{assert.doesNotMatch(backend,/HtmlService|createHtmlOutputFromFile/);assert.match(backend,/function doGet\(\)/);assert.match(backend,/SpreadsheetApp\.openById/)});
