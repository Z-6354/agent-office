import {mountFleetView} from './fleet-view.js';
import './style.css';
import {mountLiveView} from './live-view.js';
import {createOfficeScene} from './office-scene.js';
import {sceneShouldPause} from './input.js';
import {createDemoController,readPreferences,writePreferences} from './demo-controller.js';
import {roles,stages,snapshot,statusLabels,createPageCleanup,roleDetail} from './state.js';

const root=document.querySelector('#app');
root.innerHTML=`<header class="topbar"><a class="brand" href="#"><span class="brand-icon">a<span>•</span></span><div>agent office<small>把协作，看得见。</small></div></a><div class="demo-pill"><span></span>模拟演示 <b>DEMO</b></div></header>
<main><section class="intro"><div><p class="eyebrow">YOUR LITTLE AI TEAM</p><h1>一个办公室，<em>四个好搭档。</em></h1><p class="lead">从灵感到交付，看看你的 AI 团队如何一起工作。</p></div><div class="project-card"><span class="mini-icon">↗</span><div><small>正在演示的任务</small><strong>做一个轻量的个人知识库</strong></div></div></section>
<section class="workspace"><div class="scene-column"><div class="scene-toolbar"><span class="room-label"><span class="live-dot"></span>小小办公室 <small>01 / 团队空间</small></span><button id="camera" class="icon-button" aria-label="重置视角">⌂ <span>重置视角</span></button></div><div id="scene"><div class="scene-loading">正在布置办公室…</div></div><div class="scene-caption"><span>拖动旋转 · 点击人物查看详情</span><span class="sun">☀ 白日模式</span></div><div class="controls" aria-label="演示播放控制"><span class="mobile-stage" id="mobile-stage"></span><button id="play" class="primary">Ⅱ 暂停演示</button><button id="next" class="secondary">下一阶段 →</button><button id="reset" class="text-button">↺ 重播</button><span class="speed-label">每 7 秒推进</span></div></div>
<aside class="inspector"><div class="aside-heading"><p class="eyebrow">TEAM PULSE</p><span id="count" class="count">4 位伙伴</span></div><h2>大家在忙什么</h2><div id="agents" class="agents"></div><div class="detail-card"><div class="detail-top"><span id="detail-avatar" class="avatar">S</span><div><small>选中的伙伴</small><h3 id="detail-name">主管 Agent</h3></div><span id="detail-state"></span></div><p id="detail-text"></p><div class="artifact" id="artifact"></div><div class="detail-footer"><span>数据源：本地模拟</span><span id="updated">刚刚更新</span></div></div><label class="fault-label" for="fault">试试异常场景</label><select id="fault"><option value="none">正常工作流</option><option value="blocked">模拟：审阅遇到阻塞</option><option value="offline">模拟：编码 Agent 心跳超时</option></select><div class="preferences"><label for="speed">演示节奏<select id="speed"><option value="7">标准 · 每 7 秒</option><option value="12">慢速 · 每 12 秒</option></select></label><label class="motion-toggle"><input type="checkbox" id="motion">减少动态效果</label><small>只保存显示偏好，不保存任务或日志。</small></div></aside></section>
<section class="timeline-section"><div class="timeline-heading"><div><p class="eyebrow">FROM IDEA TO DONE</p><h2 id="stage-title"></h2></div><span id="stage-number"></span></div><p id="stage-summary"></p><div id="timeline" class="timeline"></div><section class="event-section"><div class="event-heading"><h3>演示交接记录</h3><span>仅本次浏览，不是真实 Agent 日志</span></div><ol id="events"></ol></section><div class="notice"><span>ⓘ</span><p>这是一个<strong>纯模拟、可交互的演示</strong>。人物动作由预设任务状态驱动，不会调用模型、执行代码或读取你的真实服务器。</p></div></section></main><footer><span>AGENT OFFICE / 一个独立的小项目</span><span>慢一点，看见每一步。</span></footer>`;
let selected='supervisor',scene=null;
const sceneHost=document.querySelector('#scene');
let storage=null;try{storage=window.localStorage;}catch{}
const systemReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let preferences=readPreferences(storage,systemReduced);
const controller=createDemoController(preferences);
const renderNotice=document.createElement('div');renderNotice.className='render-notice';renderNotice.setAttribute('role','status');renderNotice.hidden=true;sceneHost.append(renderNotice);
try{scene=createOfficeScene(sceneHost,{onSelect:selectAgent,onRenderState:state=>{renderNotice.hidden=state!=='recovering';renderNotice.textContent=state==='recovering'?'画面暂时中断，等待浏览器恢复。角色面板仍可使用。':'';},reducedMotion:preferences.reducedMotion});sceneHost.querySelector('.scene-loading')?.remove();}catch(error){sceneHost.innerHTML='<div class="fallback"><span>▧</span><h3>当前浏览器无法开启 3D</h3><p>你仍可以在角色面板查看状态，或用底部按钮体验完整工作流。试试支持 WebGL 的浏览器。</p></div>';console.warn('3D renderer unavailable:',error.message);}
const liveView=mountLiveView({scene,onModeChange:()=>{controller.pause();render();},onSelect:selectAgent,getSelected:()=>selected});
function selectAgent(id){selected=id;render();}
function render(){
  if(liveView.isLive()){liveView.render();return;}
  const state=controller.getState(),{index,fault,playing}=state;
  const focusRole=document.activeElement?.closest('.agent-row')?.dataset.role;
  const focusStage=document.activeElement?.closest('.step')?.dataset.stage;
  const states=snapshot(index,fault),stage=stages[index];
  document.querySelector('#mobile-stage').textContent=fault==='none'?stage.title.split(' · ')[0]+' · '+(index+1)+'/8':fault==='blocked'?'需要处理':'状态过期';
  scene?.setPaused(sceneShouldPause({playing,completed:index===stages.length-1,fault}));scene?.setAgents(states);scene?.setCelebrating(index===stages.length-1&&fault==='none');scene?.setSelected(selected);
  const agents=document.querySelector('#agents');agents.replaceChildren();
  for(const a of states){const button=document.createElement('button');button.dataset.role=a.id;button.className='agent-row'+(selected===a.id?' selected':'');button.setAttribute('aria-pressed',String(selected===a.id));button.innerHTML=`<span class="avatar" style="--role:${a.color}">${a.initial}</span><span class="agent-info"><strong>${a.name} Agent</strong><small>${a.job}</small></span><span class="status ${a.status}"><i></i>${statusLabels[a.status]}</span>`;button.addEventListener('click',()=>selectAgent(a.id));agents.append(button);}
  const chosen=states.find(a=>a.id===selected),detail=roleDetail(index,selected,fault);
  document.querySelector('#detail-name').textContent=chosen.name+' Agent';const avatar=document.querySelector('#detail-avatar');avatar.textContent=chosen.initial;avatar.style.setProperty('--role',chosen.color);
  document.querySelector('#detail-state').textContent=statusLabels[chosen.status];document.querySelector('#detail-state').className='status '+chosen.status;
  document.querySelector('#detail-text').textContent=detail.text;document.querySelector('#artifact').textContent=detail.artifact;
  document.querySelector('#stage-title').textContent=fault==='none'?stage.title:fault==='blocked'?'流程暂停 · 需要你的帮助':'状态过期 · 等待重新连接';
  document.querySelector('#stage-summary').textContent=fault==='none'?stage.summary:'在异常场景中选择“正常工作流”，再从原阶段继续。异常期间不会推进。';
  document.querySelector('#stage-number').textContent=String(index+1).padStart(2,'0')+' / 08';
  const play=document.querySelector('#play');play.textContent=fault!=='none'?'等待解除异常':index===stages.length-1?'↺ 再看一遍':playing?'Ⅱ 暂停演示':'▶ 继续演示';play.disabled=fault!=='none';play.setAttribute('aria-pressed',String(playing&&fault==='none'));
  document.querySelector('#next').disabled=fault!=='none'||index===stages.length-1;
  document.querySelector('.speed-label').textContent='每 '+state.seconds+' 秒推进';
  document.querySelector('#speed').value=String(state.seconds);document.querySelector('#motion').checked=preferences.reducedMotion;document.querySelector('#fault').value=fault;
  const timeline=document.querySelector('#timeline');timeline.replaceChildren();stages.forEach((s,i)=>{const b=document.createElement('button');b.dataset.stage=String(i);b.className='step '+(i===index?'current':i<index?'done':'');b.innerHTML=`<span>${i<index?'✓':String(i+1).padStart(2,'0')}</span><small>${s.title.split(' · ')[0]}</small>`;b.disabled=fault!=='none';b.setAttribute('aria-label','跳到'+s.title);b.setAttribute('aria-current',i===index?'step':'false');b.onclick=()=>{controller.jump(i);render();};timeline.append(b);});
  document.querySelector('#count').textContent=states.filter(a=>a.status==='working').length+' 位正在工作';
  const eventList=document.querySelector('#events');eventList.replaceChildren();for(const event of state.events){const li=document.createElement('li'),time=document.createElement('time'),text=document.createElement('span');time.dateTime=new Date(event.at).toISOString();time.textContent=new Date(event.at).toLocaleTimeString('zh-CN',{hour12:false});text.textContent=event.text;li.append(time,text);eventList.append(li);}
  updateAge(state.updatedAt);
  if(focusRole)document.querySelector(`[data-role="${focusRole}"]`)?.focus({preventScroll:true});
  if(focusStage)document.querySelector(`[data-stage="${focusStage}"]`)?.focus({preventScroll:true});
}
function updateAge(at){const ago=Math.max(0,Math.floor((Date.now()-at)/1000));document.querySelector('#updated').textContent=ago<2?'刚刚更新':ago+' 秒前';}
document.querySelector('#play').onclick=()=>{controller.toggle();render();};
document.querySelector('#next').onclick=()=>{controller.next();render();};
document.querySelector('#reset').onclick=()=>{controller.reset(!preferences.reducedMotion);render();};
document.querySelector('#camera').onclick=()=>scene?.resetCamera();
document.querySelector('#fault').onchange=e=>{controller.setFault(e.target.value);render();};
document.querySelector('#speed').onchange=e=>{preferences.seconds=Number(e.target.value);controller.setSpeed(preferences.seconds);writePreferences(storage,preferences);render();};
document.querySelector('#motion').onchange=e=>{preferences.reducedMotion=e.target.checked;writePreferences(storage,preferences);scene?.setReducedMotion(preferences.reducedMotion);if(preferences.reducedMotion)controller.pause();render();};
const timer=setInterval(()=>{if(document.hidden)return;if(liveView.isLive()){liveView.render();return;}const previous=controller.getState();const next=controller.tick();if(previous.index!==next.index)render();else updateAge(next.updatedAt);},1000);
const disposeFleet=mountFleetView();
window.addEventListener('pagehide',createPageCleanup(()=>{disposeFleet();clearInterval(timer);liveView.dispose();scene?.dispose();}));render();
