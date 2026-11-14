import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,createUserWithEmailAndPassword,signInWithEmailAndPassword,EmailAuthProvider,reauthenticateWithCredential,updatePassword,deleteUser,signOut,setPersistence,browserLocalPersistence,browserSessionPersistence,inMemoryPersistence,onAuthStateChanged,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,doc,collection,getDoc,getDocs,query,where,writeBatch,runTransaction,serverTimestamp,updateDoc,connectFirestoreEmulator} from 'firebase/firestore';
import {uid,text,seedProducts} from './domain.mjs';
import {studentEmail,validateNewPassword,isTeacher,schoolGrade,normalizeLoginCode,loginKey,createLoginCode,studentName,studentNameKey} from './student-login.mjs';

export class StudentAccessStore {
  constructor(config,testing={}){
    this.app=initializeApp(config,testing.name);this.auth=getAuth(this.app);this.db=getFirestore(this.app);this.shopId='';this.preparedNames=new Set();this.preparedClasses=new Set();
    if(testing.emulators){
      if(!config.projectId.startsWith('demo-'))throw new Error('Emulators require a demo project.');
      connectAuthEmulator(this.auth,'http://127.0.0.1:9098',{disableWarnings:true});
      connectFirestoreEmulator(this.db,'127.0.0.1',8086);
    }
  }
  async init(onUser){return new Promise(resolve=>{let first=true;onAuthStateChanged(this.auth,user=>{onUser(user);if(first){first=false;resolve(user);}});});}
  async persistence(automatic=false){await setPersistence(this.auth,typeof window==='undefined'?inMemoryPersistence:automatic?browserLocalPersistence:browserSessionPersistence);}
  async login(){await this.persistence(false);return (await signInWithPopup(this.auth,new GoogleAuthProvider())).user;}
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
      const code=createLoginCode(),key=kind==='classCodes'?code:loginKey(grade,code),index=this.global(kind,key);
      const result=await runTransaction(this.db,async tx=>{if((await tx.get(index)).exists())return null;return write(tx,index,code);});
      if(result)return result;
    }
    throw new Error('코드를 만들지 못했어요. 다시 시도해 주세요.');
  }
  async addClass(name,grade){
    const id=uid();grade=schoolGrade(grade);name=text(name,'학급 이름',30);
    await this.uniqueCode('classCodes',grade,(tx,index,code)=>{tx.set(this.ref('classes',id),{name,grade,joinCode:code,nextNumber:0});const data={shopId:this.shopId,classId:id,grade,code};tx.set(index,data);tx.set(this.global('classEntrances',loginKey(grade,code)),data);return code;});return id;
  }
  async setClassGrade(classId,grade){
    grade=schoolGrade(grade);const current=(await getDoc(this.ref('classes',classId))).data();
    if(current.grade)throw new Error('이미 설정한 학년은 바꿀 수 없어요. 다른 학년은 새 학급을 만들어 주세요.');
    const students=await this.rows('students',[['classId','==',classId]]),nextNumber=students.reduce((n,s)=>Math.max(n,s.number),0);
    return this.uniqueCode('classCodes',grade,(tx,index,code)=>{tx.update(this.ref('classes',classId),{grade,joinCode:code,nextNumber});const data={shopId:this.shopId,classId,grade,code};tx.set(index,data);tx.set(this.global('classEntrances',loginKey(grade,code)),data);return code;});
  }
  async reissueClass(classId){
    const c=(await getDoc(this.ref('classes',classId))).data();
    return this.uniqueCode('classCodes',c.grade,(tx,index,code)=>{tx.update(this.ref('classes',classId),{joinCode:code});const data={shopId:this.shopId,classId,grade:c.grade,code};tx.set(index,data);tx.set(this.global('classEntrances',loginKey(c.grade,code)),data);return code;});
  }
  async editStudent(id,{name,groupId,isLeader,active}){
    const ref=this.ref('students',id),before=(await getDoc(ref)).data(),nextName=name===undefined?before.name:studentName(name);
    const changes={name:nextName,groupId:text(groupId,'모둠',30),isLeader:!!isLeader,active:!!active};
    const oldKey=await studentNameKey(before.classId,before.name),nextKey=await studentNameKey(before.classId,nextName);
    if(oldKey===nextKey){await updateDoc(ref,changes);return;}
    await runTransaction(this.db,async tx=>{
      const old=await tx.get(this.global('studentNames',oldKey)),next=await tx.get(this.global('studentNames',nextKey));
      if(next.exists()&&next.data().active&&next.data().studentId!==id)throw new Error('이 학급에 같은 로그인 이름이 있어요. 다른 이름을 정해 주세요.');
      tx.update(ref,changes);
      if(old.exists()&&old.data().studentId===id){tx.update(this.global('studentNames',oldKey),{active:false});tx.set(this.global('studentNames',nextKey),{...old.data(),active:true});}
    });
  }
  async reissue(id,{allowDuplicate=false}={}){
    const s=(await getDoc(this.ref('students',id))).data(),c=(await getDoc(this.ref('classes',s.classId))).data();schoolGrade(c.grade);
    const old=await this.rows('invites',[['studentId','==',id],['active','==',true]]),token=uid(),nameKey=await studentNameKey(s.classId,s.name);
    return this.uniqueCode('studentLogins',c.grade,async(tx,index,code)=>{
      const alias=await tx.get(this.global('studentNames',nameKey)),duplicate=alias.exists()&&alias.data().active&&alias.data().studentId!==id;if(duplicate&&!allowDuplicate)throw new Error('같은 학급에 이름이 같은 학생이 있어요. 학생 설정에서 로그인 이름을 먼저 구분해 주세요.');
      old.forEach(i=>tx.update(this.ref('invites',i.id),{active:false}));
      tx.update(this.ref('students',id),{authUid:'',loginVersion:4});
      tx.set(this.ref('invites',token),{studentId:id,classId:s.classId,grade:c.grade,code,active:true,createdAt:serverTimestamp()});
      const data={shopId:this.shopId,classId:s.classId,grade:c.grade,code,token,studentId:id};tx.set(index,data);if(!duplicate)tx.set(this.global('studentNames',nameKey),{...data,active:true});return code;
    });
  }
  async prepareEntrances(data){
    let changed=false;
    for(const c of data.classes){
      if(!c.grade){const grade=c.name.match(/^([1-6])\s*학년/)?.[1];if(grade){await this.setClassGrade(c.id,grade);c.grade=Number(grade);changed=true;}}
      const nextNumber=data.students.filter(s=>s.classId===c.id).reduce((n,s)=>Math.max(n,s.number),0);
      if(c.grade&&(!Number.isInteger(c.nextNumber)||c.nextNumber<nextNumber)){await updateDoc(this.ref('classes',c.id),{nextNumber});changed=true;}
      if(c.grade)for(const s of data.students.filter(s=>s.classId===c.id&&s.loginVersion!==4)){await this.reissue(s.id,{allowDuplicate:true});changed=true;}
      if(c.grade&&c.joinCode&&!this.preparedClasses.has(this.shopId+':'+c.id+':'+c.joinCode)){const route=await getDoc(this.global('classCodes',c.joinCode));if(!route.exists()){const b=writeBatch(this.db);b.set(this.global('classCodes',c.joinCode),{shopId:this.shopId,classId:c.id,grade:c.grade,code:c.joinCode});await b.commit();}else if(route.data().classId!==c.id||route.data().shopId!==this.shopId){await this.reissueClass(c.id);changed=true;}this.preparedClasses.add(this.shopId+':'+c.id+':'+c.joinCode);}
      for(const s of data.students.filter(s=>s.classId===c.id&&s.loginVersion===4)){
        const inv=data.invites.find(i=>i.studentId===s.id&&i.active);if(!inv?.code)continue;
        const cacheKey=this.shopId+':'+s.id+':'+s.name+':'+inv.id;if(this.preparedNames.has(cacheKey))continue;
        const key=await studentNameKey(c.id,s.name),target=this.global('studentNames',key),existing=await getDoc(target);
        if(existing.exists()&&existing.data().active&&existing.data().studentId!==s.id)continue;
        if(!existing.exists()||!existing.data().active){const b=writeBatch(this.db);b.set(target,{shopId:this.shopId,classId:c.id,grade:inv.grade,code:inv.code,token:inv.id,studentId:s.id,active:true});await b.commit();}
        this.preparedNames.add(cacheKey);
      }
    }
    return changed;
  }
  async ensureStudentSession(){
    if(isTeacher(this.auth.currentUser))throw new Error('교사 계정에서 로그아웃한 뒤 학생으로 입장해 주세요.');
    if(this.auth.currentUser)await signOut(this.auth);
  }
  async resolveClass(classCode){const d=await getDoc(this.global('classCodes',normalizeLoginCode(classCode)));if(!d.exists())throw new Error('학급 가입 코드를 확인해 주세요.');return d.data();}
  async register({grade,classCode,name,password,passwordConfirm=password,autoLogin=false}){
    classCode=normalizeLoginCode(classCode);name=studentName(name);validateNewPassword(password,passwordConfirm);
    await this.ensureStudentSession();
    const route=await this.resolveClass(classCode),{shopId,classId}=route;grade=route.grade;this.shopId=shopId;
    const nameKey=await studentNameKey(classId,name);await this.persistence(autoLogin);
    const token=uid(),user=(await createUserWithEmailAndPassword(this.auth,studentEmail(token),password)).user;
    try{
      const code=await this.uniqueCode('studentLogins',grade,async(tx,index,code)=>{
        const nameRef=this.global('studentNames',nameKey),existing=await tx.get(nameRef);if(existing.exists()&&existing.data().active)throw new Error('이 학급에 이미 등록된 이름이에요. 기존 계정으로 로그인하거나 선생님과 구분할 이름을 정해 주세요.');
        tx.set(this.global('studentApplications',user.uid),{shopId,classId,grade,code,token,name,nameKey,classCode,kind:'signup',studentId:user.uid,status:'pending',createdAt:serverTimestamp()});
        const data={shopId,classId,grade,code,token,studentId:user.uid};tx.set(index,data);tx.set(nameRef,{...data,active:true});return code;
      });
      return {pending:true,grade,code,studentId:user.uid,classCode,name};
    }catch(error){await deleteUser(user).catch(()=>{});await signOut(this.auth);throw error;}
  }
  async join({grade,code,classCode,name,password,passwordConfirm=password,mode='login',autoLogin=false}){
    let nameKey,entry;
    if(classCode&&name){const c=await this.resolveClass(classCode);name=studentName(name);nameKey=await studentNameKey(c.classId,name);const index=await getDoc(this.global('studentNames',nameKey));if(!index.exists()||!index.data().active)throw new Error('학급 가입 코드와 내 이름을 확인해 주세요.');entry=index.data();grade=entry.grade;code=entry.code;}
    else {grade=schoolGrade(grade);code=normalizeLoginCode(code);const index=await getDoc(this.global('studentLogins',loginKey(grade,code)));if(!index.exists())throw new Error('로그인 정보를 확인해 주세요.');entry=index.data();}
    if(mode!=='login'&&mode!=='recover')throw new Error('로그인 방법을 확인해 주세요.');
    if(mode==='recover')validateNewPassword(password,passwordConfirm);
    await this.ensureStudentSession();
    await this.persistence(autoLogin);this.shopId=entry.shopId;
    const email=studentEmail(entry.token);
    const user=(await (mode==='recover'?createUserWithEmailAndPassword(this.auth,email,password):signInWithEmailAndPassword(this.auth,email,password))).user;
    try{
      if(mode==='recover'){
        const invitation=await getDoc(this.ref('invites',entry.token));
        if(!invitation.exists()||!invitation.data().active)throw new Error('선생님께 비밀번호 초기화를 부탁해 주세요.');
        const batch=writeBatch(this.db);
        batch.set(this.global('studentApplications',user.uid),{shopId:this.shopId,classId:entry.classId,grade,code,token:entry.token,name:'',...(nameKey?{nameKey}:{}),classCode:'',kind:'recover',studentId:entry.studentId,status:'pending',createdAt:serverTimestamp()});
        await batch.commit();
      }
      return {...await this.finishJoin(),grade,code,classCode,name};
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
      if(a.nameKey){const alias=await tx.get(this.global('studentNames',a.nameKey));if(!alias.exists()||alias.data().token!==a.token||!alias.data().active)throw new Error('이전 로그인 정보로 접수된 신청이에요.');}
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
  async rejectApplication(id){const a=(await getDoc(this.global('studentApplications',id))).data(),b=writeBatch(this.db);b.update(this.global('studentApplications',id),{status:'rejected',resolvedAt:serverTimestamp()});if(a.kind==='signup'&&a.nameKey){const ref=this.global('studentNames',a.nameKey),alias=await getDoc(ref);if(alias.exists()&&alias.data().token===a.token)b.update(ref,{active:false});}await b.commit();}
  async changePassword(currentPassword,newPassword,confirmation){
    validateNewPassword(newPassword,confirmation);const user=this.auth.currentUser;
    if(!user||isTeacher(user)||!user.email)throw new Error('학생으로 다시 로그인해 주세요.');
    await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));await updatePassword(user,newPassword);
  }
  async binding(){if(!this.auth.currentUser)return null;const d=await getDoc(this.ref('bindings',this.auth.currentUser.uid));return d.exists()?d.data():null;}
}
