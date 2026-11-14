import {text,integer} from './domain.mjs';

export const normalizeQuizAnswer=value=>text(String(value??'').normalize('NFKC').trim().replace(/\s+/g,' '),'정답',80);
export const sameQuizAnswer=(a,b)=>String(a).toLowerCase().replace(/\s/g,'')===String(b).toLowerCase().replace(/\s/g,'');
export function quizInput(input){
  const type=input.type==='ox'?'ox':input.type==='short'?'short':'choice';
  const options=type==='short'?[]:type==='ox'?['O (맞다)','X (아니다)']:[0,1,2,3].map(i=>text(input['option'+i]??input.options?.[i],'보기 '+(i+1),80));
  return {question:text(input.question,'문제',300),classId:text(input.classId,'학급',50),type,options,reward:integer(input.reward,'정답 보상',1,1000),...(type==='short'?{answerText:normalizeQuizAnswer(input.answerText)}:{answerIndex:integer(input.answerIndex,'정답',0,options.length-1)})};
}
export function splitQuizInput(input){const {answerIndex,answerText,...quiz}=quizInput(input);return {quiz,key:quiz.type==='short'?{answerText}:{answerIndex}};}
export const quizAttemptId=(quizId,studentId)=>quizId+'__'+studentId;
export const quizEventId=attemptId=>'quiz_'+attemptId;
