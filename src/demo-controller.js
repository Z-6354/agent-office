import {stages} from './state.js';
const faults=new Set(['none','blocked','offline']);
const speeds=new Set([7,12]);
export function createDemoController({now=Date.now, reducedMotion=false, seconds=7}={}) {
  let state={index:0,fault:'none',playing:!reducedMotion,elapsed:0,seconds:speeds.has(seconds)?seconds:7,updatedAt:now(),events:[]};
  let eventId=0;
  function record(text){state.updatedAt=now();state.events=[{id:++eventId,at:state.updatedAt,text},...state.events].slice(0,12);}
  function view(){return {...state,events:state.events.map(e=>({...e}))};}
  function reset(playing=true){state.index=0;state.fault='none';state.playing=playing;state.elapsed=0;state.events=[];record('开始模拟：晨会与目标确认');return view();}
  function next(){if(state.fault!=='none'||state.index===stages.length-1)return view();state.index++;state.elapsed=0;record('进入模拟阶段：'+stages[state.index].title);if(state.index===stages.length-1)state.playing=false;return view();}
  reset(!reducedMotion);
  return {
    getState:view,next,reset,
    jump(index){if(!Number.isInteger(index)||index<0||index>=stages.length||state.fault!=='none'||index===state.index)return view();state.index=index;state.elapsed=0;record('手动查看模拟阶段：'+stages[index].title);if(index===stages.length-1)state.playing=false;return view();},
    pause(){if(state.playing){state.playing=false;record('暂停模拟演示');}return view();},
    toggle(){if(state.fault!=='none')return view();if(state.index===stages.length-1)return reset(true);state.playing=!state.playing;record(state.playing?'继续模拟演示':'暂停模拟演示');return view();},
    setFault(fault){if(!faults.has(fault)||state.fault===fault)return view();state.fault=fault;state.elapsed=0;record(fault==='none'?'已解除模拟异常':fault==='blocked'?'注入模拟异常：审阅阻塞':'注入模拟异常：编码角色心跳超时');return view();},
    setSpeed(seconds){if(!speeds.has(seconds))return view();state.seconds=seconds;state.elapsed=0;return view();},
    tick(){if(!state.playing||state.fault!=='none')return view();if(++state.elapsed>=state.seconds)return next();return view();},
  };
}
export function readPreferences(storage, systemReduced=false) {
  const defaults={reducedMotion:!!systemReduced,seconds:7};
  try {const raw=JSON.parse(storage.getItem('agent-office:preferences')||'null');if(!raw||typeof raw!=='object')return defaults;return {reducedMotion:typeof raw.reducedMotion==='boolean'?raw.reducedMotion:defaults.reducedMotion,seconds:speeds.has(raw.seconds)?raw.seconds:7};} catch{return defaults;}
}
export function writePreferences(storage, preferences) {
  try{storage.setItem('agent-office:preferences',JSON.stringify({reducedMotion:!!preferences.reducedMotion,seconds:speeds.has(preferences.seconds)?preferences.seconds:7}));return true;}catch{return false;}
}
