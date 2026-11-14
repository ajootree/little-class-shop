import {splitQuizInput,normalizeQuizAnswer} from './quiz.mjs';

export const MAX_QUIZ_IMPORT=100,MAX_CSV_BYTES=524288;
export function decodeQuizCsv(bytes){if(bytes.byteLength>MAX_CSV_BYTES)throw new Error('CSV 파일은 512KB 이하로 준비해 주세요.');try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('euc-kr',{fatal:true}).decode(bytes);}}
function csvRows(source){
  if(source.length>200000)throw new Error('CSV 내용이 너무 길어요.');
  source=source.replace(/^\uFEFF/,'');const delimiter=source.split(/\r?\n/,1)[0].includes('\t')&&!source.split(/\r?\n/,1)[0].includes(',')?'\t':',';
  const rows=[];let row=[],cell='',quoted=false,closed=false,line=1,startLine=1;
  const pushCell=()=>{row.push(cell);cell='';closed=false;};
  const pushRow=()=>{pushCell();if(row.some(v=>v.trim()))rows.push({cells:row,line:startLine});row=[];if(rows.length>MAX_QUIZ_IMPORT+1)throw new Error('한 번에 100문제까지 가져올 수 있어요.');};
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else{if(c==='\r'){if(source[i+1]==='\n')i++;cell+='\n';line++;}else{cell+=c;if(c==='\n')line++;}}continue;}
    if(c===delimiter){pushCell();continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;pushRow();line++;startLine=line;continue;}
    if(closed){if(!/\s/.test(c))throw new Error(line+'행: 닫는 따옴표 뒤의 문자를 확인해 주세요.');continue;}
    if(c==='"'){if(cell.trim())throw new Error(line+'행: 따옴표 위치를 확인해 주세요.');cell='';quoted=true;continue;}
    cell+=c;
  }
  if(quoted)throw new Error(startLine+'행: 닫히지 않은 따옴표가 있어요.');
  if(cell||row.length||closed)pushRow();return rows;
}
export function parseQuizCsv(source,classId){
  const rows=csvRows(String(source));if(rows.length<2)throw new Error('첫 줄에 문제·정답 열 제목을 넣고, 그 아래에 문제를 입력해 주세요.');
  const aliases={문제:'question',질문:'question',question:'question',정답:'answer',answer:'answer',유형:'type',type:'type',포인트:'reward',보상:'reward',reward:'reward'};
  for(let i=1;i<=4;i++){aliases['보기'+i]='option'+(i-1);aliases['option'+i]='option'+(i-1);}
  const headers=rows[0].cells.map(v=>aliases[v.normalize('NFKC').toLowerCase().replace(/\s/g,'')]||'');
  if(!headers.includes('question')||!headers.includes('answer'))throw new Error('CSV에 문제와 정답 열이 필요해요.');
  if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error('중복된 열 제목이 있어요.');
  return rows.slice(1).map(({cells,line})=>{
    try{
      if(cells.length!==headers.length)throw new Error('열 개수가 첫 줄과 달라요. 쉼표가 들어간 내용은 큰따옴표로 감싸 주세요.');
      const item={};headers.forEach((key,i)=>{if(key)item[key]=cells[i].trim();});
      const answer=normalizeQuizAnswer(item.answer),raw=(item.type||'').toLowerCase().replace(/\s/g,''),ox=answer.toUpperCase();
      let type;if(!raw)type=[0,1,2,3].some(i=>item['option'+i])?'choice':['O','X','○','×'].includes(ox)?'ox':'short';else if(['ox','o/x'].includes(raw))type='ox';else if(['4지선다','객관식','choice'].includes(raw))type='choice';else if(['단답형','주관식','short'].includes(raw))type='short';else throw new Error('유형은 OX, 4지선다, 단답형 중에서 골라 주세요.');
      const input={...item,classId,type,reward:item.reward||10};
      if(type==='short')input.answerText=answer;
      else if(type==='ox'){if(!['O','X','○','×'].includes(ox))throw new Error('OX 정답은 O 또는 X로 적어 주세요.');input.answerIndex=['O','○'].includes(ox)?0:1;}
      else{input.answerIndex=/^[1-4]$/.test(answer)?Number(answer)-1:[0,1,2,3].find(i=>String(item['option'+i]||'').normalize('NFKC').toLowerCase()===answer.toLowerCase());if(input.answerIndex===undefined)throw new Error('정답은 보기 번호 1~4 또는 보기 내용으로 적어 주세요.');}
      const {quiz,key}=splitQuizInput(input);return {...quiz,...key,sourceLine:line};
    }catch(error){throw new Error(line+'행: '+error.message);}
  });
}
export async function prepareQuizImport(inputs){
  if(!Array.isArray(inputs)||inputs.length<1||inputs.length>MAX_QUIZ_IMPORT)throw new Error('1~100문제를 준비해 주세요.');
  const seen=new Set(),jobs=[];
  for(const input of inputs){
    const {quiz}=splitQuizInput(input);
    // Use public question fields only: hashing a secret answer would leak a
    // guessable answer. Stable IDs make interrupted imports safe to repeat.
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(quiz)));
    const id=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('').slice(0,32);
    if(seen.has(id))throw new Error((input.sourceLine||jobs.length+2)+'행: 같은 문제가 중복돼 있어요.');seen.add(id);jobs.push({id,input});
  }
  return jobs;
}
