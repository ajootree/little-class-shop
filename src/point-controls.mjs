import {escapeHTML as e} from './domain.mjs';

// Preserve existing exact prices/rewards while each slider move changes by ten.
function sliderLimits(value,min,max){const start=min+((value-min)%10+10)%10;return {min:start,max:max-(max-start)%10};}

export function pointControl({label,name,value,min=1,max,unit}){
  const id=`point-${name}`;
  const bounds=sliderLimits(Number(value),min,max);
  return `<fieldset class="point-control" data-point-control data-unit="${e(unit)}"><legend>${e(label)}</legend><div class="point-control-heading"><output for="${id}-slider ${id}-number" data-point-output>${value} ${e(unit)}</output></div><input id="${id}-slider" type="range" min="${bounds.min}" max="${bounds.max}" step="10" value="${value}" aria-label="${e(label)} 슬라이더" aria-valuetext="${value} ${e(unit)}" data-point-slider><div class="point-control-scale" aria-hidden="true"><span data-point-min>${bounds.min}</span><span data-point-max>${bounds.max}</span></div><label class="point-number-label" for="${id}-number">직접 입력<input id="${id}-number" name="${e(name)}" type="number" min="${min}" max="${max}" step="1" value="${value}" required data-point-number></label></fieldset>`;
}

export function syncPointControl(input){
  const group=input.closest('[data-point-control]');
  if(!group||!input.matches('[data-point-slider],[data-point-number]'))return;
  const slider=group.querySelector('[data-point-slider]'),number=group.querySelector('[data-point-number]'),output=group.querySelector('[data-point-output]');
  const valid=input.value!==''&&Number.isSafeInteger(Number(input.value))&&Number(input.value)>=Number(number.min)&&Number(input.value)<=Number(number.max);
  if(!valid){output.textContent='범위를 확인해 주세요';return;}
  const value=input.value;
  if(input===slider)number.value=value;
  else {const bounds=sliderLimits(Number(value),Number(number.min),Number(number.max));slider.min=bounds.min;slider.max=bounds.max;slider.value=value;group.querySelector('[data-point-min]').textContent=bounds.min;group.querySelector('[data-point-max]').textContent=bounds.max;}
  const description=`${value} ${group.dataset.unit}`;
  slider.setAttribute('aria-valuetext',description);output.value=description;output.textContent=description;
}
