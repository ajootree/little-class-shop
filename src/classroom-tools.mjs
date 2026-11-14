import {integer} from './domain.mjs';

export function randomIndex(max){
  integer(max,'추첨 범위',1,0x100000000);
  const ceiling=Math.floor(0x100000000/max)*max;
  let value;do{value=crypto.getRandomValues(new Uint32Array(1))[0];}while(value>=ceiling);
  return value%max;
}
export function shuffled(items,pick=randomIndex){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=pick(i+1);[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function drawRoster(data,classId,mode){const students=data.students.filter(s=>s.classId===classId&&s.active).sort((a,b)=>a.number-b.number);return mode==='group'?[...new Set(students.map(s=>s.groupId))].map(name=>({id:name,name})):students.map(s=>({id:s.id,name:s.number+'번 '+s.name}));}
export function timerDuration(minutes,seconds){return integer(integer(minutes,'분',0,180)*60+integer(seconds,'초',0,59),'타이머',1,10800)*1000;}
export function clockText(milliseconds){const seconds=Math.max(0,Math.ceil(milliseconds/1000));return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
export class LessonTimer{
  constructor({now=Date.now,storage=null,key='class-shop-lesson-timer'}={}){
    this.now=now;this.storage=storage;this.key=key;this.duration=300000;this.remaining=300000;this.deadline=0;this.status='ready';this.sound=true;
    try{const d=JSON.parse(storage?.getItem(key)||'null');if(d&&Number.isInteger(d.duration)&&d.duration>=1000&&d.duration<=10800000&&Number.isFinite(d.remaining)&&d.remaining>=0&&d.remaining<=d.duration&&Number.isFinite(d.deadline)&&['ready','running','paused','finished'].includes(d.status)){this.duration=d.duration;this.remaining=d.remaining;this.deadline=d.deadline;this.status=d.status;this.sound=d.sound!==false;this.tick();}}catch{}
  }
  save(){try{this.storage?.setItem(this.key,JSON.stringify({duration:this.duration,remaining:this.remaining,deadline:this.deadline,status:this.status,sound:this.sound}));}catch{}}
  set(duration){this.duration=integer(duration,'시간',1000,10800000);this.reset();}
  start(){if(this.status==='running')return;if(this.remaining<=0)this.remaining=this.duration;this.deadline=this.now()+this.remaining;this.status='running';this.save();}
  tick(){if(this.status!=='running')return false;this.remaining=Math.max(0,this.deadline-this.now());if(this.remaining===0){this.status='finished';this.deadline=0;this.save();return true;}return false;}
  pause(){this.tick();if(this.status==='running'){this.status='paused';this.deadline=0;this.save();}}
  reset(){this.remaining=this.duration;this.status='ready';this.deadline=0;this.save();}
}
