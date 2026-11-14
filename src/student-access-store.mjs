import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,createUserWithEmailAndPassword,signInWithEmailAndPassword,EmailAuthProvider,reauthenticateWithCredential,updatePassword,deleteUser,signOut,setPersistence,browserSessionPersistence,onAuthStateChanged,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,doc,collection,getDoc,getDocs,query,where,writeBatch,runTransaction,serverTimestamp,updateDoc,connectFirestoreEmulator} from 'firebase/firestore';
import {uid,text,seedProducts} from './domain.mjs';
import {studentEmail,validateNewPassword,isTeacher,schoolGrade,normalizeLoginCode,loginKey,createLoginCode} from './student-login.mjs';

export class StudentAccessStore {
  constructor(config,testing={}){
    this.app=initializeApp(config,testing.name);this.auth=getAuth(this.app);this.db=getFirestore(this.app);this.shopId='';
    if(testing.emulators){
      if(!config.projectId.startsWith('demo-'))throw new Error('Emulators require a demo project.');
      connectAuthEmulator(this.auth,'http://127.0.0.1:9098',{disableWarnings:true});
      connectFirestoreEmulator(this.db,'127.0.0.1',8086);
    }
  }
  async init(onUser){await setPersistence(this.auth,browserSessionPersistence);return new Promise(resolve=>{let first=true;onAuthStateChanged(this.auth,user=>{onUser(user);if(first){first=false;resolve(user);}});});}
  async login(){return (await signInWithPopup(this.auth,new GoogleAuthProvider())).user;}
  async logout(){await signOut(this.auth);}
  ref(kind,id){return doc(this.db,'shops',this.shopId,kind,id);}
  col(kind){return collection(this.db,'shops',this.shopId,kind);}
  global(kind,id){return doc(this.db,kind,id);}
  async rows(kind,conditions=[]){const q=conditions.length?query(this.col(kind),...conditions.map(([field,op,value])=>where(field,op,value))):this.col(kind);return (await getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));}
  async applications(){return (await getDocs(query(collection(this.db,'studentApplications'),where('shopId','==',this.shopId)))).docs.map(d=>({id:d.id,...d.data()}));}
  async myShops(){if(!this.auth.currentUser)return [];const refs=(await getDocs(collection(this.db,'users',this.auth.currentUser.uid,'shops'))).docs;return (await Promise.all(refs.map(r=>getDoc(doc(this.db,'shops',r.id))))).filter(d=>d.exists()).map(d=>({id:d.id,...d.data()}));}
  async open(id){this.shopId=id;const d=await getDoc(doc(this.db,'shops',id));if(!d.exists())throw new Error('상점을 찾을 수 없어요.');return {id,...d.data()};}
  async createShop(input){const id=uid(),d={ownerUid:this.auth.currentUser.uid,teacherName:text(input.teacherName,'선생님 이름',24),shopName:text(input.shopName,'상점 이름',32),currencyName:text(input.currencyName,'포인트 이름',12),createdAt:serverTimestamp()},batch=writeBatch(this.db);batch.set(doc(this.db,'shops',id),d);batch.set(doc(this.db,'users',d.ownerUid,'shops',id),{shopId:id});await batch.commit();this.shopId=id;for(const p of seedProducts)await this.addProduct(p);return {id,...d};}
  async saveShop(input){await updateDoc(doc(this.db,'shops',this.shopId),{teacherName:text(input.teacherName,'선생님 이름',24),shopName:text(input.shopName,'상점 이름',32),currencyName:text(input.currencyName,'포인트 이름',12)});}
  async uniqueCode(kind,grade,write){
    for(let attempt=0;attempt<8;attempt++){
      const code=createLoginCode(),key=loginKey(grade,code),index=this.global(kind,key);
      const result=await runTransaction(this.db,async tx=>{if((await tx.get(index)).exists())return null;return write(tx,index,code);});
      if(result)return result;
    }
    throw new Error('코드를 만들지 못했어요. 다시 시도해 주세요.');
  }
  async addClass(name,grade){
    const id=uid();grade=schoolGrade(grade);name=text(name,'학급 이름',30);
    await this.uniqueCode('classEntrances',grade,(tx,index,code)=>{tx.set(this.ref('classes',id),{name,grade,joinCode:code,nextNumber:0});tx.set(index,{shopId:this.shopId,classId:id,grade,code});return code;});return id;
  }
  async setClassGrade(classId,grade){
    grade=schoolGrade(grade);const current=(await getDoc(this.ref('classes',classId))).data();
    if(current.grade)throw new Error('이미 설정한 학년은 바꿀 수 없어요. 다른 학년은 새 학급을 만들어 주세요.');
    const students=await this.rows('students',[['classId','==',classId]]),nextNumber=students.reduce((n,s)=>Math.max(n,s.number),0);
    return this.uniqueCode('classEntrances',grade,(tx,index,code)=>{tx.update(this.ref('classes',classId),{grade,joinCode:code,nextNumber});tx.set(index,{shopId:this.shopId,classId,grade,code});return code;});
  }
  async reissueClass(classId){
    const c=(await getDoc(this.ref('classes',classId))).data();
    return this.uniqueCode('classEntrances',c.grade,(tx,index,code)=>{tx.update(this.ref('classes',classId),{joinCode:code});tx.set(index,{shopId:this.shopId,classId,grade:c.grade,code});return code;});
  }
  async editStudent(id,{groupId,isLeader,active}){await updateDoc(this.ref('students',id),{groupId:text(groupId,'모둠',30),isLeader:!!isLeader,active:!!active});}
  async reissue(id){
    const s=(await getDoc(this.ref('students',id))).data(),c=(await getDoc(this.ref('classes',s.classId))).data();schoolGrade(c.grade);
    const old=await this.rows('invites',[['studentId','==',id],['active','==',true]]),token=uid();
    return this.uniqueCode('studentLogins',c.grade,(tx,index,code)=>{
      old.forEach(i=>tx.update(this.ref('invites',i.id),{active:false}));
      tx.update(this.ref('students',id),{authUid:'',loginVersion:4});
      tx.set(this.ref('invites',token),{studentId:id,classId:s.classId,grade:c.grade,code,active:true,createdAt:serverTimestamp()});
      tx.set(index,{shopId:this.shopId,classId:s.classId,grade:c.grade,code,token,studentId:id});return code;
    });
  }
  async prepareEntrances(data){
    let changed=false;
    for(const c of data.classes){
      if(!c.grade){const grade=c.name.match(/^([1-6])\s*학년/)?.[1];if(grade){await this.setClassGrade(c.id,grade);c.grade=Number(grade);changed=true;}}
      const nextNumber=data.students.filter(s=>s.classId===c.id).reduce((n,s)=>Math.max(n,s.number),0);
      if(c.grade&&(!Number.isInteger(c.nextNumber)||c.nextNumber<nextNumber)){await updateDoc(this.ref('classes',c.id),{nextNumber});changed=true;}
      if(c.grade)for(const s of data.students.filter(s=>s.classId===c.id&&s.loginVersion!==4)){await this.reissue(s.id);changed=true;}
    }
    return changed;
  }
  async ensureStudentSession(){
    if(isTeacher(this.auth.currentUser))throw new Error('교사 계정에서 로그아웃한 뒤 학생으로 입장해 주세요.');
    if(this.auth.currentUser)await signOut(this.auth);
  }
  async register({grade,classCode,name,password,passwordConfirm}){
    grade=schoolGrade(grade);classCode=normalizeLoginCode(classCode);name=text(name,'이름 또는 별명',24);validateNewPassword(password,passwordConfirm);
    await this.ensureStudentSession();
    const entry=await getDoc(this.global('classEntrances',loginKey(grade,classCode)));
    if(!entry.exists())throw new Error('학년과 학급 가입 코드를 확인해 주세요.');
    const {shopId,classId}=entry.data();this.shopId=shopId;
    const token=uid(),user=(await createUserWithEmailAndPassword(this.auth,studentEmail(token),password)).user;
    try{
      const code=await this.uniqueCode('studentLogins',grade,(tx,index,code)=>{
        tx.set(this.global('studentApplications',user.uid),{shopId,classId,grade,code,token,name,classCode,kind:'signup',studentId:user.uid,status:'pending',createdAt:serverTimestamp()});
        tx.set(index,{shopId,classId,grade,code,token,studentId:user.uid});return code;
      });
      return {pending:true,grade,code,studentId:user.uid};
    }catch(error){await deleteUser(user).catch(()=>{});await signOut(this.auth);throw error;}
  }
  async join({grade,code,password,passwordConfirm,mode='login'}){
    grade=schoolGrade(grade);code=normalizeLoginCode(code);
    if(mode!=='login'&&mode!=='recover')throw new Error('로그인 방법을 확인해 주세요.');
    if(mode==='recover')validateNewPassword(password,passwordConfirm);
    await this.ensureStudentSession();
    const index=await getDoc(this.global('studentLogins',loginKey(grade,code)));
    if(!index.exists())throw new Error('학년과 개인 코드를 확인해 주세요.');
    const entry=index.data();this.shopId=entry.shopId;
    const email=studentEmail(entry.token);
    const user=(await (mode==='recover'?createUserWithEmailAndPassword(this.auth,email,password):signInWithEmailAndPassword(this.auth,email,password))).user;
    try{
      if(mode==='recover'){
        const invitation=await getDoc(this.ref('invites',entry.token));
        if(!invitation.exists()||!invitation.data().active)throw new Error('선생님께 비밀번호 초기화와 새 코드를 부탁해 주세요.');
        const batch=writeBatch(this.db);
        batch.set(this.global('studentApplications',user.uid),{shopId:this.shopId,classId:entry.classId,grade,code,token:entry.token,name:'',classCode:'',kind:'recover',studentId:entry.studentId,status:'pending',createdAt:serverTimestamp()});
        await batch.commit();
      }
      return {...await this.finishJoin(),grade,code};
    }catch(error){if(mode==='recover')await deleteUser(user).catch(()=>{});await signOut(this.auth);throw error;}
  }
  async finishJoin(){
    const user=this.auth.currentUser;if(!user||isTeacher(user))throw new Error('학생으로 로그인해 주세요.');
    const b=await this.binding();
    if(b){await getDoc(this.ref('students',b.studentId));return {pending:false,studentId:b.studentId};}
    const application=await getDoc(this.global('studentApplications',user.uid));
    if(!application.exists())throw new Error('가입 신청이 없어요. 다시 신청해 주세요.');
    const a=application.data();this.shopId=a.shopId;
    if(a.status==='rejected')throw new Error('선생님이 신청을 반려했어요. 선생님께 확인해 주세요.');
    return {pending:true,grade:a.grade,code:a.code,studentId:a.studentId};
  }
  async approveApplication(id){
    await runTransaction(this.db,async tx=>{
      const applicationRef=this.global('studentApplications',id),a=(await tx.get(applicationRef)).data();
      if(!a||a.status!=='pending'||a.shopId!==this.shopId)throw new Error('이미 처리했거나 다른 상점의 신청이에요.');
      const classRef=this.ref('classes',a.classId),c=(await tx.get(classRef)).data();
      const studentRef=this.ref('students',a.studentId),before=await tx.get(studentRef);
      const index=(await tx.get(this.global('studentLogins',loginKey(a.grade,a.code)))).data();
      if(index?.token!==a.token)throw new Error('초기화된 코드로 접수된 이전 신청이에요.');
      if(a.kind==='recover'){
        if(!before.exists()||before.data().authUid!=='')throw new Error('이미 연결된 계정이 있어요. 필요하면 먼저 초기화해 주세요.');
        tx.update(studentRef,{authUid:id,loginVersion:4});
      }else{
        if(before.exists())throw new Error('이미 등록된 학생이에요.');
        const number=(c.nextNumber||0)+1;
        tx.update(classRef,{nextNumber:number});
        tx.set(studentRef,{name:a.name,number,classId:a.classId,groupId:Math.ceil(number/4)+'모둠',isLeader:false,balance:0,authUid:id,loginVersion:4,lastEventId:'',active:true});
        tx.set(this.ref('invites',a.token),{studentId:a.studentId,classId:a.classId,grade:a.grade,code:a.code,active:true,createdAt:serverTimestamp()});
      }
      tx.set(this.ref('bindings',id),{studentId:a.studentId,classId:a.classId,token:a.token});
      tx.update(applicationRef,{status:'approved',resolvedAt:serverTimestamp()});
    });
  }
  async rejectApplication(id){await updateDoc(this.global('studentApplications',id),{status:'rejected',resolvedAt:serverTimestamp()});}
  async changePassword(currentPassword,newPassword,confirmation){
    validateNewPassword(newPassword,confirmation);const user=this.auth.currentUser;
    if(!user||isTeacher(user)||!user.email)throw new Error('학생으로 다시 로그인해 주세요.');
    await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));await updatePassword(user,newPassword);
  }
  async binding(){if(!this.auth.currentUser)return null;const d=await getDoc(this.ref('bindings',this.auth.currentUser.uid));return d.exists()?d.data():null;}
}
