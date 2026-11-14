import {text,integer} from './domain.mjs';

export function quizInput(input){
  const type=input.type==='ox'?'ox':'choice';
  const options=type==='ox'?['O (맞다)','X (아니다)']:[0,1,2,3].map(i=>text(input['option'+i]??input.options?.[i],'보기 '+(i+1),80));
  return {question:text(input.question,'문제',300),classId:text(input.classId,'학급',50),type,options,reward:integer(input.reward,'정답 보상',1,1000),answerIndex:integer(input.answerIndex,'정답',0,options.length-1)};
}
export const quizAttemptId=(quizId,studentId)=>quizId+'__'+studentId;
export const quizEventId=attemptId=>'quiz_'+attemptId;
