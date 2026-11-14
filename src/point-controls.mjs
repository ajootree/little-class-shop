import {escapeHTML as e} from './domain.mjs';

export function pointControl({label,name,value,min=1,max,unit}){
  const id=`point-${name}`;
  return `<fieldset class="point-control" data-point-control data-unit="${e(unit)}"><legend>${e(label)}</legend><div class="point-control-heading"><label for="${id}-slider">밀어서 조절</label><output for="${id}-slider ${id}-number" data-point-output>${value} ${e(unit)}</output></div><input id="${id}-slider" type="range" min="${min}" max="${max}" step="1" value="${value}" aria-label="${e(label)} 슬라이더" aria-valuetext="${value} ${e(unit)}" data-point-slider><div class="point-control-scale" aria-hidden="true"><span>${min}</span><span>${max}</span></div><label class="point-number-label" for="${id}-number">직접 입력<input id="${id}-number" name="${e(name)}" type="number" min="${min}" max="${max}" step="1" value="${value}" required data-point-number></label></fieldset>`;
}

export function syncPointControl(input){
  const group=input.closest('[data-point-control]');
  if(!group||!input.matches('[data-point-slider],[data-point-number]'))return;
  const slider=group.querySelector('[data-point-slider]'),number=group.querySelector('[data-point-number]'),output=group.querySelector('[data-point-output]');
  const valid=input.value!==''&&Number.isSafeInteger(Number(input.value))&&Number(input.value)>=Number(slider.min)&&Number(input.value)<=Number(slider.max);
  if(!valid){output.textContent='범위를 확인해 주세요';return;}
  const value=input.value;
  if(input===slider)number.value=value;
  else slider.value=value;
  const description=`${value} ${group.dataset.unit}`;
  slider.setAttribute('aria-valuetext',description);output.value=description;output.textContent=description;
  const preview=input.form?.querySelector('[data-reward-preview]');
  if(preview)preview.textContent=`한 번 완료하면 학생에게 ${value} ${group.dataset.unit}를 적립해요.`;
}
