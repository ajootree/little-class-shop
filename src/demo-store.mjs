import {demoSeed,uid,text,integer,checkedBalance,purchaseBalance} from './domain.mjs';
const key='little-class-shop-demo-v1';
export class DemoStore{
  constructor(){try{this.data=JSON.parse(sessionStorage.getItem(key))||demoSeed();}catch{this.data=demoSeed();}this.shopId='demo';}
  save(){sessionStorage.setItem(key,JSON.stringify(this.data));}
  async load(){return structuredClone(this.data);}
  async open(){return this.data.shop;}
  async addClass(name){const id=uid();this.data.classes.push({id,name:text(name,'학급',30)});this.save();return id;}
  async addStudents(classId,names){const result=[];for(const name of names.split(/\r?\n/).filter(Boolean)){const id=uid(),s={id,name:text(name,'이름',24),number:this.data.students.length+1,classId,groupId:'1모둠',isLeader:false,balance:0,authUid:'',lastEventId:'',active:true};this.data.students.push(s);const token=uid();this.data.invites.push({id:token,studentId:id,classId,active:true});result.push({...s,token});}this.save();return result;}
  async editStudent(id,changes){Object.assign(this.data.students.find(s=>s.id===id),changes);this.save();}
  async reissue(id){this.data.invites.filter(i=>i.studentId===id).forEach(i=>i.active=false);const token=uid();this.data.invites.push({id:token,studentId:id,active:true});this.save();return token;}
  async addTask(input){const id=uid();this.data.tasks.push({...input,id,title:text(input.title,'과제',100),reward:integer(input.reward,'포인트',1,1000),active:true,createdAt:Date.now()});this.save();return id;}
  async editTask(id,changes){Object.assign(this.data.tasks.find(t=>t.id===id),changes);this.save();}
  async addProduct(p){this.data.products.push({...p,id:uid(),price:integer(p.price,'가격',1,10000),stock:integer(p.stock,'재고',0,10000),art:Number(p.art),active:true});this.save();}
  async editProduct(id,p){Object.assign(this.data.products.find(p=>p.id===id),p,{price:integer(p.price,'가격',1,10000),stock:integer(p.stock,'재고',0,10000),art:Number(p.art)});this.save();}
  event(type,studentId,amount,note){const e={id:uid(),type,studentId,amount,note,createdAt:Date.now()};this.data.events.push(e);return e.id;}
  async confirm(taskId,studentId,desired){const t=this.data.tasks.find(t=>t.id===taskId),s=this.data.students.find(s=>s.id===studentId);let c=this.data.checks.find(c=>c.taskId===taskId&&c.studentId===studentId);const old=!!c?.active;if(typeof desired==='boolean'&&old===desired)return;s.balance=checkedBalance(s.balance,old?-c.reward:t.reward);if(!c){c={id:taskId+'__'+studentId,taskId,studentId,classId:s.classId,reward:t.reward};this.data.checks.push(c);}c.active=!old;c.updatedAt=Date.now();this.event(old?'revoke':'award',studentId,old?-c.reward:t.reward,t.title);this.save();}
  async adjust(studentId,amount,note){amount=integer(amount,'포인트',-10000,10000);if(!amount)throw new Error('0 이외의 포인트를 입력해 주세요.');const s=this.data.students.find(s=>s.id===studentId);s.balance=checkedBalance(s.balance,amount);this.event('adjust',studentId,amount,text(note,'사유',120));this.save();}
  async purchase(studentId,productId){const s=this.data.students.find(s=>s.id===studentId),p=this.data.products.find(p=>p.id===productId);s.balance=purchaseBalance(s,p);p.stock--;this.data.orders.push({id:uid(),studentId,classId:s.classId,productId,productName:p.name,price:p.price,status:'pending',createdAt:Date.now()});this.event('purchase',studentId,-p.price,p.name);this.save();}
  async deliver(id){this.data.orders.find(o=>o.id===id).status='delivered';this.save();}
  async refund(id){const o=this.data.orders.find(o=>o.id===id);if(o.status!=='pending')throw new Error('이미 처리한 주문이에요.');const s=this.data.students.find(s=>s.id===o.studentId),p=this.data.products.find(p=>p.id===o.productId);s.balance=checkedBalance(s.balance,o.price);p.stock++;o.status='cancelled';this.event('refund',s.id,o.price,p.name);this.save();}
  async saveShop(input){Object.assign(this.data.shop,input);this.save();}
  subscribe(){return ()=>{};}
}
