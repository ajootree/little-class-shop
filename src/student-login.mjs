// Passwords are passed only to Firebase Authentication, never to Firestore.
export function normalizeStudentCode(value){
  const code=String(value??'').replace(/[\s-]/g,'').toLowerCase();
  if(!/^[a-f0-9]{32}$/.test(code))throw new Error('개인 입장 코드 32자리를 다시 확인해 주세요.');
  return code;
}
export const normalizeClassName=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');
export const studentEmail=code=>`${normalizeStudentCode(code)}@students.class-shop.invalid`;
export function normalizeLoginCode(value){const code=String(value??'').replace(/[\s-]/g,'').toUpperCase();if(!/^[A-Z]{2}[0-9]{4}$/.test(code))throw new Error('코드는 알파벳 2자리와 숫자 4자리로 입력해 주세요. 예: AB1234');return code;}
export function schoolGrade(value){const grade=Number(value);if(!Number.isInteger(grade)||grade<1||grade>6)throw new Error('학년을 선택해 주세요.');return grade;}
export const loginKey=(grade,code)=>schoolGrade(grade)+'-'+normalizeLoginCode(code);
export function createLoginCode(){const pick=n=>{let v;do{v=crypto.getRandomValues(new Uint8Array(1))[0];}while(v>=256-256%n);return v%n;};return String.fromCharCode(65+pick(26),65+pick(26))+Array.from({length:4},()=>pick(10)).join('');}
export function validateNewPassword(password,confirmation){
  if(typeof password!=='string'||password.length<12||password.length>128||!password.trim())throw new Error('비밀번호는 12~128자로 정해 주세요. 기억하기 쉬운 긴 문장을 사용해도 좋아요.');
  if(password!==confirmation)throw new Error('새 비밀번호와 확인 입력이 서로 달라요.');
  return password;
}
export const isTeacher=user=>!!user?.providerData?.some(p=>p.providerId==='google.com');
