import {runTransaction,writeBatch,serverTimestamp,updateDoc} from 'firebase/firestore';
import {uid,integer} from './domain.mjs';
import {StudentAccessStore} from './student-access-store.mjs';
import {quizInput,quizAttemptId,quizEventId} from './quiz.mjs';

export class QuizStore extends StudentAccessStore{
  async quizData(owner,studentId,classId){
    const [quizzes,quizAttempts,quizKeys]=await Promise.all([
      this.rows('quizzes',owner?[]:[['classId','==',classId]]),
      this.rows('quizAttempts',owner?[]:[['studentId','==',studentId]]),
      owner?this.rows('quizKeys'):Promise.resolve([])
    ]);return {quizzes,quizAttempts,quizKeys};
  }
  async addQuiz(input){
    const {answerIndex,...q}=quizInput(input),id=uid(),b=writeBatch(this.db);
    b.set(this.ref('quizzes',id),{...q,active:true,createdAt:serverTimestamp()});
    b.set(this.ref('quizKeys',id),{answerIndex});await b.commit();return id;
  }
  async setQuizActive(id,active){await updateDoc(this.ref('quizzes',id),{active:!!active});}
  async submitQuiz(quizId,studentId,choice){
    const id=quizAttemptId(quizId,studentId);
    await runTransaction(this.db,async tx=>{
      const [qs,as]=await Promise.all([tx.get(this.ref('quizzes',quizId)),tx.get(this.ref('quizAttempts',id))]);
      if(as.exists())throw new Error('이미 제출한 퀴즈예요. 답은 바꿀 수 없어요.');
      const q=qs.data();if(!q?.active)throw new Error('참여가 마감된 퀴즈예요.');
      choice=integer(choice,'답',0,q.options.length-1);
      // Commit the answer before consulting the private answer in rules. This
      // separate immutable write prevents probing different answers for rewards.
      tx.set(this.ref('quizAttempts',id),{quizId,studentId,classId:q.classId,choice,status:'submitted',correct:false,earned:0,lastEventId:'',createdAt:serverTimestamp(),gradedAt:null});
    });
    return this.finishQuiz(id);
  }
  async finishQuiz(id){
    // A correct-claim write is checked against the private key by Firestore.
    // If denied, settle the already locked answer as incorrect instead. Neither
    // branch can change the submitted choice or award a second reward.
    try{return await this.gradeQuiz(id,true);}catch(error){
      if(error.code!=='permission-denied')throw error;
      return this.gradeQuiz(id,false);
    }
  }
  async gradeQuiz(id,correct){
    return runTransaction(this.db,async tx=>{
      const ar=this.ref('quizAttempts',id),as=await tx.get(ar);if(!as.exists())throw new Error('제출한 답안이 없어요.');
      const a=as.data();if(a.status==='graded')return {correct:a.correct,earned:a.earned};
      const [qs,ss]=await Promise.all([tx.get(this.ref('quizzes',a.quizId)),tx.get(this.ref('students',a.studentId))]);
      const q=qs.data(),s=ss.data(),earned=correct?q.reward:0,eventId=correct?quizEventId(id):'';
      tx.update(ar,{status:'graded',correct,earned,lastEventId:eventId,gradedAt:serverTimestamp()});
      if(correct){tx.update(this.ref('students',a.studentId),{balance:s.balance+earned,lastEventId:eventId});tx.set(this.ref('events',eventId),this.event('quiz',a.studentId,earned,id,'',q.question.slice(0,120)));}
      return {correct,earned};
    });
  }
  async finishPendingQuizzes(quizId){
    const attempts=await this.rows('quizAttempts',[['quizId','==',quizId]]);let count=0;
    for(const a of attempts.filter(a=>a.status==='submitted')){await this.finishQuiz(a.id);count++;}
    return count;
  }
}
