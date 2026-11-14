export function playDrumRoll(context){
  if(!context||context.state!=='running')return ()=>{};
  const nodes=[];let offset=0;
  for(let i=0;i<18;i++){
    const at=context.currentTime+offset,osc=context.createOscillator(),gain=context.createGain();osc.type='triangle';osc.frequency.setValueAtTime(150,at);osc.frequency.exponentialRampToValueAtTime(55,at+.08);gain.gain.setValueAtTime(.085,at);gain.gain.exponentialRampToValueAtTime(.001,at+.09);osc.connect(gain);gain.connect(context.destination);osc.start(at);osc.stop(at+.1);osc.onended=()=>{osc.disconnect();gain.disconnect();};nodes.push(osc);offset+=.17-i*.006;
  }
  return ()=>{nodes.forEach(osc=>{try{osc.stop();}catch{}});};
}
