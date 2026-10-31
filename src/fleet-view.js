import {parseFleetSnapshot,effectiveFleetCard,fleetIds} from './fleet-state.js';
const connectionLabels={reachable:'MCP 可达',unavailable:'连接异常',unknown:'尚未验证'};
const taskLabels={unknown:'任务状态未知',waiting:'已登记任务等待中',working:'已登记任务进行中',done:'已登记任务完成',failed:'已登记任务失败',cancelled:'已登记任务取消'};
export function mountFleetView({onUpdate=()=>{}}={}) {
  const section=document.createElement('section');section.className='fleet-panel';
  const title=document.createElement('h2');title.textContent='服务器工作观察 · 只读';
  const note=document.createElement('p');note.textContent='每 30 秒刷新。可达不代表空闲；仅追踪已登记任务，超过 90 秒未更新则显示未知。';
  const cards=document.createElement('div');cards.className='fleet-cards';section.append(title,note,cards);document.querySelector('main').append(section);
  let snapshot=null,stopped=false,request=null;
  function render(){cards.replaceChildren();const effective=[];for(const id of fleetIds){
    const raw=snapshot?.servers.find(s=>s.sourceId===id)||{sourceId:id,connection:'unknown',task:'unknown',checkedAt:null,summary:''};
    const s=effectiveFleetCard(raw);effective.push(s);const card=document.createElement('article'),h=document.createElement('h3'),state=document.createElement('p'),summary=document.createElement('p'),time=document.createElement('small');
    h.textContent=id.toUpperCase();state.textContent=connectionLabels[s.connection]+' · '+taskLabels[s.task];summary.textContent=s.summary||'暂无已批准的公开工作摘要';time.textContent=s.checkedAt?(s.stale?'已过期 · ':'检查于 ')+new Date(s.checkedAt).toLocaleString('zh-CN'):'等待接入实际观察数据';card.dataset.task=s.task;card.dataset.source=id;card.append(h,state,summary,time);cards.append(card);
  }onUpdate(effective);for(const [id,value] of [['reachable-count',effective.filter(s=>s.connection==='reachable').length+' / 3'],['working-count',effective.filter(s=>s.task==='working').length],['done-count',effective.filter(s=>s.task==='done').length]]){const el=document.getElementById(id);if(el)el.textContent=snapshot?String(value):'—';}}
  async function poll(){if(stopped)return;request=new AbortController();const timeout=setTimeout(()=>request?.abort(),8000);try{const r=await fetch('/fleet-status.json',{cache:'no-store',redirect:'error',credentials:'omit',signal:request.signal});if(!r.ok)throw Error();const text=await r.text();if(text.length>16384)throw Error();const next=parseFleetSnapshot(JSON.parse(text));if(!stopped)snapshot=next;}catch {/* Retain timestamp; stale data never becomes a live state. */}finally{clearTimeout(timeout);request=null;if(!stopped)render();}}
  render();poll();const timer=setInterval(poll,30000);const age=setInterval(render,5000);
  return ()=>{stopped=true;request?.abort();clearInterval(timer);clearInterval(age);};
}
