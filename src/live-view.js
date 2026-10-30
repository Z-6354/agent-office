import {createLiveConnection,liveAgents,safeLiveOrigin} from './live-state.js';
import {statusLabels} from './state.js';
export function mountLiveView({scene,onModeChange,onSelect,getSelected}){
  const secureOrigin=safeLiveOrigin(window.location.origin);
  let live=false,state={phase:'disconnected',snapshot:null,receivedAt:0};
  const q=s=>document.querySelector(s), original={pill:q('.demo-pill').innerHTML,notice:q('.notice p').innerHTML,project:q('.project-card').innerHTML};
  const panel=document.createElement('section');panel.className='source-panel';panel.innerHTML=`<div class="source-tabs" role="group" aria-label="选择数据来源"><button id="source-demo" aria-pressed="true">模拟 DEMO</button><button id="source-live" aria-pressed="false">只读观察 LIVE</button></div><div id="live-connect" hidden><p>仅连接此网站同源的只读事件服务，不会启动 Agent 或调用模型。静态预览未配置后端时无法连接。这里仅接受 Agent Office 只读观察令牌，不是 Magpie / 模型 API 密钥或管理员凭据，请勿输入这些凭据。</p><form id="connection-form"><label for="viewer-token">Agent Office 只读观察令牌</label><input id="viewer-token" type="password" autocomplete="off" spellcheck="false" placeholder="仅保存在本次连接内存中"><button class="primary" type="submit">连接</button><button class="secondary" id="disconnect-live" type="button">断开</button></form><p id="connection-status" role="status"></p></div>`;
  q('.intro').after(panel);q('#viewer-token').disabled=!secureOrigin;
  const connection=createLiveConnection({onChange:next=>{state=next;if(live)render();}});
  function switchMode(next){live=next;if(!live)connection.disconnect();q('#viewer-token').value='';document.body.classList.toggle('live-mode',live);q('#live-connect').hidden=!live;q('#source-live').setAttribute('aria-pressed',String(live));q('#source-demo').setAttribute('aria-pressed',String(!live));
    for(const selector of ['.controls','.fault-label','#fault','.preferences','#timeline'])q(selector).hidden=live;
    q('.demo-pill').innerHTML=live?'只读观察 <b>LIVE</b>':original.pill;
    q('.detail-footer span').textContent=live?'数据源：同源只读事件':'数据源：本地模拟';
    q('.event-heading h3').textContent=live?'接收到的事件':'演示交接记录';q('.event-heading span').textContent=live?'报告仅为来源证据，不代表独立验收':'仅本次浏览，不是真实 Agent 日志';
    q('.notice p').textContent=live?'LIVE 只显示后端收到的报告；心跳在线不代表任务有进展。断连或过期后人物状态标为未知，历史报告不代表实时状态。不会派发、编辑或执行任务。':'';
    if(!live){q('.notice p').innerHTML=original.notice;q('.project-card').innerHTML=original.project;}
    else q('.project-card').textContent='只读观察 · 不执行任务';
    onModeChange(live);
  }
  q('#source-demo').onclick=()=>switchMode(false);q('#source-live').onclick=()=>switchMode(true);
  q('#connection-form').onsubmit=e=>{e.preventDefault();const input=q('#viewer-token'),token=input.value;input.value='';connection.connect(token);};q('#disconnect-live').onclick=()=>connection.disconnect();
  const date=value=>value?new Date(value).toLocaleTimeString('zh-CN',{hour12:false}):'尚未收到';
  function render(){
    const states=liveAgents(state.snapshot,state.phase==='connected',Date.now(),state.receivedAt),selected=getSelected(),chosen=states.find(a=>a.id===selected),report=chosen.report;
    const labels={insecure:'为保护令牌，请使用 HTTPS 或本机 loopback 页面',disconnected:'未连接 / 已断开',connecting:'正在连接同源只读服务…',connected:'已连接 · 每 3 秒读取',unauthorized:'令牌缺失或被拒绝，请重新输入',error:'连接失败或响应不兼容；请确认同源后端后手动重连'};
    q('#connection-status').textContent=labels[secureOrigin?state.phase:'insecure'];q('#connection-form button[type="submit"]').disabled=!secureOrigin||state.phase==='connecting';
    scene?.setPaused(true);scene?.setAgents(states);scene?.setCelebrating(false);scene?.setSelected(selected);
    const focus=document.activeElement?.closest('.agent-row')?.dataset.role;q('#agents').replaceChildren();
    for(const a of states){const b=document.createElement('button');b.className='agent-row'+(a.id===selected?' selected':'');b.dataset.role=a.id;b.setAttribute('aria-pressed',String(a.id===selected));
      const avatar=document.createElement('span');avatar.className='avatar';avatar.style.setProperty('--role',a.color);avatar.textContent=a.initial;
      const info=document.createElement('span');info.className='agent-info';const title=document.createElement('strong');title.textContent=a.name+' Agent';const sub=document.createElement('small');sub.textContent=a.job;info.append(title,sub);
      const status=document.createElement('span');status.className='status '+a.status;status.textContent=a.stale?'未知 / 过期':a.report.status==='failed'?'报告失败':a.report.status==='cancelled'?'已取消':statusLabels[a.status];b.append(avatar,info,status);b.onclick=()=>onSelect(a.id);q('#agents').append(b);
    }
    q('#detail-name').textContent=chosen.name+' Agent';q('#detail-avatar').textContent=chosen.initial;q('#detail-avatar').style.setProperty('--role',chosen.color);q('#detail-state').className='status '+chosen.status;q('#detail-state').textContent=chosen.stale?'状态未知':report.status==='failed'?'报告失败':report.status==='cancelled'?'已取消':statusLabels[chosen.status];
    q('#detail-text').textContent=(chosen.stale?'当前状态不可确认。最后报告：':'来源报告：')+(report?.message||'尚无任务进展报告');
    q('#artifact').textContent='心跳：'+date(report?.lastHeartbeatAt)+' · 进展：'+date(report?.lastProgressAt)+(report?.progress!==null&&report?.progress!==undefined?' · 报告进度 '+report.progress+'%':'')+(report?.runId?' · Run '+report.runId:'');
    q('#updated').textContent='读取：'+date(state.receivedAt||null);q('#count').textContent=states.filter(a=>!a.stale).length+' 位状态可用';q('#stage-title').textContent='只读观察 · '+(state.phase==='connected'?'来源已连接':'状态不可确认');q('#stage-summary').textContent='角色是否在线取决于心跳；进展时间单独显示，不用心跳推断任务成功。';q('#stage-number').textContent='LIVE / READ ONLY';
    q('#events').replaceChildren();for(const event of [...(state.snapshot?.events||[])].reverse().slice(0,30)){const li=document.createElement('li'),time=document.createElement('time'),text=document.createElement('span');time.textContent=date(event.receivedAt);text.textContent=event.agentId+' · '+event.type+' · '+event.message;li.append(time,text);q('#events').append(li);}
    if(!state.snapshot?.events.length){const li=document.createElement('li');li.textContent='尚未收到来源事件；这里不会显示模拟日志。';q('#events').append(li);}
    if(focus)q(`[data-role="${focus}"]`)?.focus({preventScroll:true});
  }
  const onPageHide=()=>{q('#viewer-token').value='';connection.disconnect();};
  window.addEventListener('pagehide',onPageHide);
  return {isLive:()=>live,render,dispose:()=>{window.removeEventListener('pagehide',onPageHide);connection.disconnect();}};
}
