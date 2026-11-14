import test,{before,beforeEach,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {deleteApp} from 'firebase/app';
import {GoogleAuthProvider,signInWithCredential,signOut,signInWithEmailAndPassword} from 'firebase/auth';
import {doc,getDoc,getDocs,collection,writeBatch,setDoc,updateDoc,serverTimestamp,setLogLevel} from 'firebase/firestore';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {FirebaseStore} from '../src/firebase-store.mjs';
import {studentEmail,loginKey} from '../src/student-login.mjs';

const projectId='demo-class-shop',password='our-science-class-2026',newPassword='new-science-class-2026';
let env,teacher,classId,classCode,stores=[];
function store(){const s=new FirebaseStore({projectId,apiKey:'fake-api-key',authDomain:'demo-class-shop.firebaseapp.com'},{name:crypto.randomUUID(),emulators:true});stores.push(s);return s;}
before(async()=>{setLogLevel('silent');env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8086,rules:await fs.readFile('firestore.rules','utf8')}});});
beforeEach(async()=>{
  await env.clearFirestore();
  await fetch(`http://127.0.0.1:9098/emulator/v1/projects/${projectId}/accounts`,{method:'DELETE'});
  teacher=store();
  await signInWithCredential(teacher.auth,GoogleAuthProvider.credential(JSON.stringify({sub:'teacher',email:'teacher@example.com',email_verified:true})));
  const shop=await teacher.createShop({teacherName:'검증',shopName:'검증 상점',currencyName:'별'});teacher.shopId=shop.id;
  classId=await teacher.addClass('4학년 2반',4);
  classCode=(await getDoc(teacher.ref('classes',classId))).data().joinCode;
});
afterEach(async()=>{await Promise.all(stores.map(async s=>{await signOut(s.auth);await deleteApp(s.app);}));stores=[];});
after(async()=>{await env?.cleanup();});
async function signup(name='학생'){const s=store(),r=await s.register({grade:4,classCode,name,password,passwordConfirm:password});return {s,r};}
async function approve(s){await teacher.approveApplication(s.auth.currentUser.uid);return s.finishJoin();}

test('직접 가입은 승인 전 명단·과제·상점 접근을 차단하고 승인 후 본인 기록을 연다',async()=>{
 const {s,r}=await signup('지우');assert.equal(r.pending,true);assert.match(r.code,/^[A-Z]{2}\d{4}$/);
 await assertFails(getDocs(s.col('students')));await assertFails(getDocs(s.col('products')));await assertFails(getDocs(s.col('tasks')));
 await assertFails(updateDoc(s.global('studentApplications',s.auth.currentUser.uid),{status:'approved'}));
 const finished=await approve(s);assert.equal(finished.pending,false);const data=await s.load({owner:false});assert.equal(data.students[0].name,'지우');assert.equal(data.students[0].balance,0);
 await s.logout();await s.join({grade:4,code:r.code.toLowerCase(),password});assert.equal((await s.load({owner:false})).students[0].name,'지우');
});

test('동명이인도 서로 다른 개인 코드를 가지며 타인의 기록·가입 신청을 읽지 못한다',async()=>{
 const a=await signup('지우'),b=await signup('지우');assert.notEqual(a.r.code,b.r.code);await approve(a.s);await approve(b.s);
 await assertFails(getDoc(a.s.ref('students',b.r.studentId)));await assertFails(getDoc(a.s.global('studentApplications',b.s.auth.currentUser.uid)));
 const rows=await teacher.applications();assert.equal(rows.length,2);assert.ok(rows.every(a=>!('password' in a)&&!('passwordHash' in a)));
});

test('다른 교사와 신청 학생은 승인·바인딩 생성·학생 문서 생성을 할 수 없다',async()=>{
 const {s}=await signup();const id=s.auth.currentUser.uid;
 await assertFails(setDoc(s.ref('bindings',id),{studentId:id,classId,token:'a'.repeat(32)}));
 const stranger=env.authenticatedContext('other-teacher',{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 await assertFails(getDoc(doc(stranger,'studentApplications',id)));await assertFails(updateDoc(doc(stranger,'studentApplications',id),{status:'approved',resolvedAt:serverTimestamp()}));
 await assertFails(setDoc(s.ref('students',id),{name:'학생',number:1,classId,groupId:'1모둠',isLeader:true,balance:999,authUid:id,loginVersion:4,lastEventId:'',active:true}));
});

test('비밀번호 오류는 로그인 실패, 본인 변경은 기존 비밀번호를 폐기한다',async()=>{
 const {s,r}=await signup();await approve(s);await assert.rejects(()=>s.changePassword('wrong-password',newPassword,newPassword));
 await s.changePassword(password,newPassword,newPassword);await s.logout();
 await assert.rejects(()=>s.join({grade:4,code:r.code,password}));
 await s.join({grade:4,code:r.code,password:newPassword});assert.equal((await s.finishJoin()).pending,false);
});

test('교사 초기화는 이전 세션을 차단하고 재승인 후 포인트·수행·구매 기록을 보존한다',async()=>{
 const {s,r}=await signup('서연');await approve(s);
 const taskId=await teacher.addTask({classId,title:'실험관찰',reward:5,allowLeader:false});await teacher.confirm(taskId,r.studentId,true);
 await teacher.adjust(r.studentId,20,'검증 포인트');const products=await teacher.rows('products');await s.purchase(r.studentId,products[0].id);
 const before=(await getDoc(teacher.ref('students',r.studentId))).data();const oldUid=s.auth.currentUser.uid;
 const code=await teacher.reissue(r.studentId);await assertFails(getDoc(s.ref('students',r.studentId)));
 const recovery=store(),result=await recovery.join({grade:4,code,password:newPassword,passwordConfirm:newPassword,mode:'recover'});
 assert.equal(result.pending,true);assert.notEqual(recovery.auth.currentUser.uid,oldUid);await assertFails(getDoc(recovery.ref('students',r.studentId)));
 await approve(recovery);const after=(await getDoc(recovery.ref('students',r.studentId))).data();assert.equal(after.balance,before.balance);assert.equal(after.name,'서연');
 assert.equal((await recovery.load({owner:false})).orders.length,1);assert.ok((await getDoc(teacher.ref('checks',taskId+'__'+r.studentId))).data().active);
 await assertFails(getDoc(s.ref('students',r.studentId)));await assert.rejects(()=>s.join({grade:4,code:r.code,password}));
});

test('학급 가입 코드 교체는 기존 가입자의 로그인을 유지하고 이전 코드의 신규 가입을 막는다',async()=>{
 const {s,r}=await signup();await approve(s);await teacher.reissueClass(classId);
 const newcomer=store();await assert.rejects(()=>newcomer.register({grade:4,classCode,name:'새 학생',password,passwordConfirm:password}));
 await s.logout();await s.join({grade:4,code:r.code,password});assert.equal((await s.finishJoin()).pending,false);
});

test('거절된 가입은 기록 접근을 얻지 못하고 서로의 비밀번호를 데이터에서 조회할 수 없다',async()=>{
 const {s}=await signup();await teacher.rejectApplication(s.auth.currentUser.uid);await assert.rejects(()=>s.finishJoin());await assertFails(getDocs(s.col('students')));
 await assertFails(setDoc(s.global('studentApplications',s.auth.currentUser.uid),{password}));
 const applications=await teacher.applications();assert.equal(applications[0].status,'rejected');assert.ok(!JSON.stringify(applications).includes(password));
});

test('기존 코드 전용 학생은 최초 교사 로드에서 새 코드로 전환하되 포인트를 유지한다',async()=>{
 await env.withSecurityRulesDisabled(async c=>{const b=writeBatch(c.firestore());b.set(doc(c.firestore(),'shops',teacher.shopId,'students','legacy'),{name:'기존 학생',number:12,classId,groupId:'3모둠',isLeader:false,balance:45,authUid:'old-anonymous',lastEventId:'',active:true});b.set(doc(c.firestore(),'shops',teacher.shopId,'invites','a'.repeat(32)),{studentId:'legacy',classId,active:true,createdAt:new Date()});await b.commit();});
 const data=await teacher.load({owner:true});const s=data.students.find(s=>s.id==='legacy'),i=data.invites.find(i=>i.studentId==='legacy'&&i.active);assert.equal(s.balance,45);assert.equal(s.authUid,'');assert.equal(s.loginVersion,4);assert.match(i.code,/^[A-Z]{2}\d{4}$/);
 const index=(await getDoc(teacher.global('studentLogins',loginKey(4,i.code)))).data();assert.equal(index.studentId,'legacy');
});

test('동시에 승인한 가입은 학생 번호를 중복 발급하지 않는다',async()=>{
 const a=await signup('첫째'),b=await signup('둘째');await Promise.all([teacher.approveApplication(a.s.auth.currentUser.uid),teacher.approveApplication(b.s.auth.currentUser.uid)]);
 const students=await teacher.rows('students');assert.equal(students.length,2);assert.equal(new Set(students.map(s=>s.number)).size,2);
});

test('새로 초기화한 뒤 이전 코드의 재설정 신청을 승인할 수 없다',async()=>{
 const {s,r}=await signup();await approve(s);const code=await teacher.reissue(r.studentId);const recovering=store();await recovering.join({grade:4,code,password:newPassword,passwordConfirm:newPassword,mode:'recover'});
 await teacher.reissue(r.studentId);await assert.rejects(()=>teacher.approveApplication(recovering.auth.currentUser.uid));
 assert.equal((await getDoc(teacher.ref('students',r.studentId))).data().authUid,'');await assertFails(getDoc(recovering.ref('students',r.studentId)));
});
