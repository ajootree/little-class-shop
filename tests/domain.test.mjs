import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedBalance,purchaseBalance,canConfirm,escapeHTML,integer} from '../src/domain.mjs';
test('잔액은 음수·정수 범위 밖으로 변경할 수 없다',()=>{assert.equal(checkedBalance(35,-10),25);assert.throws(()=>checkedBalance(3,-5));assert.throws(()=>checkedBalance(1000000,1));assert.throws(()=>integer(1.5,'가격',1,100));});
test('품절과 잔액 부족은 구매를 막는다',()=>{assert.equal(purchaseBalance({balance:35},{active:true,stock:1,price:10}),25);assert.throws(()=>purchaseBalance({balance:35},{active:true,stock:0,price:10}));assert.throws(()=>purchaseBalance({balance:5},{active:true,stock:1,price:10}));});
test('모둠장 확인은 지정된 과제·같은 모둠·타인에 한정된다',()=>{const actor={id:'a',classId:'c',groupId:'g',isLeader:true},target={id:'b',classId:'c',groupId:'g'},task={allowLeader:true};assert.ok(canConfirm({actor,target,task}));assert.ok(!canConfirm({actor,target:actor,task}));assert.ok(!canConfirm({actor,target:{...target,groupId:'h'},task}));assert.ok(!canConfirm({actor,target,task:{allowLeader:false}}));});
test('이름과 상점 입력은 실행 가능한 마크업이 되지 않는다',()=>{assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');});
