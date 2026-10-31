import express from 'express';
import cors from 'cors';
import {OAuth2Client} from 'google-auth-library';
import {google} from 'googleapis';
import {Firestore} from '@google-cloud/firestore';

const required=['GOOGLE_CLIENT_ID','SHEET_ID','ALLOWED_ORIGIN','GOOGLE_CLOUD_PROJECT'];
for(const k of required) if(!process.env[k]) throw new Error('Missing '+k);
const app=express(), oauth=new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const sheets=google.sheets({version:'v4',auth:new google.auth.GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets']})});
const db=new Firestore({projectId:process.env.GOOGLE_CLOUD_PROJECT});
const SID=process.env.SHEET_ID;
const TAB={people:'拍攝學生名單',tasks:'ShootTasks',schedule:'拍攝流程',checkins:'CheckIns',live:'LiveControl',logs:'ActivityLogs',users:'Users'};
app.disable('x-powered-by');app.set('trust proxy',1);app.use(cors({origin:process.env.ALLOWED_ORIGIN,methods:['GET','POST'],allowedHeaders:['Authorization','Content-Type']}));app.use(express.json({limit:'32kb'}));
const a1=(s)=>"'"+s.replaceAll("'","''")+"'";
async function read(name){const r=await sheets.spreadsheets.values.get({spreadsheetId:SID,range:a1(name)+'!A1:Z2000'});const [keys=[],...rows]=r.data.values||[];return {keys,rows,records:rows.map((row,i)=>Object.fromEntries([['__row',i+2],...keys.map((k,j)=>[k,row[j]||''])]))};}
async function writeCell(tab,row,key,value){const col=tab.keys.indexOf(key);if(col<0)throw Error('Missing field '+key);let n=col+1,label='';while(n){n--;label=String.fromCharCode(65+n%26)+label;n=Math.floor(n/26)}await sheets.spreadsheets.values.update({spreadsheetId:SID,range:a1(tab.name)+'!'+label+row,valueInputOption:'RAW',requestBody:{values:[[value]]}});}
async function append(name,row){await sheets.spreadsheets.values.append({spreadsheetId:SID,range:a1(name)+'!A1',valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[row]}});}
const withName=async name=>({...await read(name),name});
async function audit(user,action,id,details={}){await append(TAB.logs,[new Date().toISOString(),user.email,action,id||'',JSON.stringify(details)]);}
app.use(async(req,res,next)=>{if(req.path==='/health')return next();try{const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token) return res.status(401).json({error:'Login required'});const ticket=await oauth.verifyIdToken({idToken:token,audience:process.env.GOOGLE_CLIENT_ID});const email=(ticket.getPayload()?.email||'').toLowerCase();if(!ticket.getPayload()?.email_verified||!email)return res.status(403).json({error:'Email not verified'});const users=await read(TAB.users);const row=users.records.find(x=>String(x.email).toLowerCase()===email&&String(x.enabled).toUpperCase()==='TRUE');if(!row||!['管理員','admin','staff','工作人員'].includes(row.role))return res.status(403).json({error:'Staff access required'});req.user={email,role:row.role};next();}catch(e){res.status(401).json({error:'Invalid login token'});}});
app.get('/health',(_req,res)=>res.json({ok:true,service:'CUFA API'}));
app.get('/api/dashboard',async(req,res,next)=>{try{const [p,t,s,l]=await Promise.all([read(TAB.people),read(TAB.tasks),read(TAB.schedule),read(TAB.live)]);res.set('Cache-Control','no-store');res.json({people:p.records.filter(x=>x.personId),tasks:t.records.filter(x=>x.taskId),schedule:s.records.filter(x=>x.slotId),live:Object.fromEntries(l.records.filter(x=>x.key).map(x=>[x.key,x.value]))});}catch(e){next(e)}});
async function setLive(key,value,operator){const t=await withName(TAB.live);const row=t.records.find(x=>x.key===key);if(row){await writeCell(t,row.__row,'value',value);await writeCell(t,row.__row,'updatedAt',new Date().toISOString());await writeCell(t,row.__row,'operator',operator);}else await append(TAB.live,[key,value,new Date().toISOString(),operator]);}
app.post('/api/action',async(req,res,next)=>{try{const {action,personId,taskId,status,notes,checkedItems,consentStatus}=req.body||{};if(!['checkIn','call','start','finish','task'].includes(action))return res.status(400).json({error:'Invalid action'});if(action==='checkIn'&&consentStatus!=='已確認')return res.status(400).json({error:'Consent verification required'});const people=await withName(TAB.people),p=people.records.find(x=>x.personId===personId);
if(action!=='finish'&&action!=='task'&&!p)return res.status(404).json({error:'Person not found'});
if(action==='checkIn'){
  if(p.queueNo)return res.json({queueNo:p.queueNo,alreadyCheckedIn:true});
  const checkins=await read(TAB.checkins);
  const currentMax=Math.max(0,...[...people.records,...checkins.records].map(x=>Number(String(x.queueNo||'').replace(/^A/,''))).filter(Number.isFinite));
  const ref=db.collection('cufa-control').doc('checkin-sequence');
  const personRef=db.collection('cufa-checkins').doc(personId);
  const q=await db.runTransaction(async tx=>{
    const [seq,existing]=await Promise.all([tx.get(ref),tx.get(personRef)]);
    if(existing.exists)return existing.data().queueNo;
    const next=Math.max(currentMax+1,(seq.exists?seq.data().next:1)||1);
    const assigned='A'+String(next).padStart(2,'0');
    tx.set(ref,{next:next+1},{merge:true});
    tx.set(personRef,{queueNo:assigned,createdAt:new Date().toISOString()});
    return assigned;
  });
  await writeCell(people,p.__row,'queueNo',q);await writeCell(people,p.__row,'checkInStatus','已報到');
  if(!checkins.records.some(x=>x.personId===personId))await append(TAB.checkins,[personId,q,new Date().toISOString(),req.user.email,consentStatus]);
  await audit(req.user,'CHECK_IN',personId,{queueNo:q});return res.json({queueNo:q});
}
if(action==='call'||action==='start'){if(!p.queueNo)return res.status(409).json({error:'Not checked in'});if(action==='call'){await setLive('calledPersonId',personId,req.user.email);}else{await setLive('slatePersonId',personId,req.user.email);await setLive('activePersonId',personId,req.user.email);}await audit(req.user,action.toUpperCase(),personId);return res.json({ok:true});}
if(action==='finish'){await setLive('activePersonId','',req.user.email);await audit(req.user,'FINISH','');return res.json({ok:true,slateRetained:true});}
if(action==='task'){if(!['待報到','待拍攝','拍攝中','已完成','需補拍','缺席'].includes(status))return res.status(400).json({error:'Invalid status'});const t=await withName(TAB.tasks),task=t.records.find(x=>x.taskId===taskId);if(!task)return res.status(404).json({error:'Task not found'});await writeCell(t,task.__row,'status',status);await writeCell(t,task.__row,'notes',String(notes||'').slice(0,2000));await writeCell(t,task.__row,'checkedItems',String(checkedItems||'').slice(0,1000));await audit(req.user,'TASK_STATUS',task.personId,{taskId,status});return res.json({ok:true});}
}catch(e){next(e)}});
app.use((err,req,res,next)=>{console.error('API error',err.message);res.status(500).json({error:'Server error. Check administrator logs.'})});
app.listen(process.env.PORT||8080,()=>console.log('CUFA API listening'));
