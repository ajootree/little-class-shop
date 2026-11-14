import {escapeHTML as e,integer} from './domain.mjs';

export const productArts=[
  {name:'지우개'},{name:'음악 선택권'},{name:'스티커'},{name:'칭찬 편지'},
  {name:'연필 세트',file:'pencils.png'},{name:'미니 공책',file:'notebook.png'},
  {name:'토끼 책갈피',file:'bookmark.png'},{name:'토끼 키링',file:'keyring.png'},
  {name:'작은 간식',file:'snack.png'},{name:'깜짝 뽑기',file:'capsule.png'},
  {name:'자리 선택권',file:'seat-ticket.png'},{name:'활동 선택권',file:'activity-ticket.png'}
];
export const artIndex=value=>integer(value,'상품 그림',0,productArts.length-1);
export function productPicture(value,extra=''){
  const index=Number.isInteger(Number(value))&&productArts[Number(value)]?Number(value):0,a=productArts[index];
  return `<span class="product-picture art-${index} ${a.file?'has-image':''} ${e(extra)}" aria-hidden="true">${a.file?`<img src="./assets/rewards/${a.file}" alt="" loading="lazy" decoding="async">`:''}</span>`;
}
export function artPicker(selected=0){return `<fieldset class="art-picker"><legend>상품 그림</legend><div class="art-picker-grid">${productArts.map((a,i)=>`<label class="art-option"><input type="radio" name="art" value="${i}" ${Number(selected)===i?'checked':''} required>${productPicture(i,'art-thumbnail')}<span>${e(a.name)}</span></label>`).join('')}</div></fieldset>`;}
