export const roles = [
  {id:'supervisor',name:'主管',job:'协调与汇报',initial:'S',color:'#aa744e'},
  {id:'planner',name:'规划',job:'拆解与设计',initial:'P',color:'#699687'},
  {id:'coder',name:'编码',job:'实现与修复',initial:'C',color:'#668caa'},
  {id:'reviewer',name:'审阅',job:'独立质量检查',initial:'R',color:'#a68cb0'},
];
export const stages = [
  {id:'brief',title:'晨会 · 接收需求',summary:'主管召集团队，确认目标与交付标准。',statuses:['meeting','meeting','meeting','meeting'],detail:'任务：做一个轻量的个人知识库。团队正在统一目标，确定最小可用范围。'},
  {id:'planning',title:'规划 · 拆解任务',summary:'规划 Agent 列出方案，其他成员等待任务交接。',statuses:['waiting','working','idle','idle'],detail:'输出数据结构、页面清单与验收标准。此处所有任务和状态均为本地模拟。'},
  {id:'coding',title:'编码 · 把想法变成代码',summary:'编码 Agent 在工位执行，规划 Agent 随时答疑。',statuses:['waiting','waiting','working','idle'],detail:'正在实现搜索、标签和收藏模块，准备提交给独立审阅角色。'},
  {id:'reviewing',title:'审阅 · 第二双眼睛',summary:'审阅 Agent 检查实现，不把“已完成”直接当作通过。',statuses:['waiting','idle','waiting','working'],detail:'检查边界条件、异常状态与测试覆盖；本轮将模拟发现一项问题。'},
  {id:'rework',title:'返工 · 修好最后一处细节',summary:'编码 Agent 接收反馈，修复后重新提交。',statuses:['waiting','idle','working','waiting'],detail:'模拟反馈：空搜索结果缺少提示。任务返回编码角色，保留原审阅意见。'},
  {id:'approved',title:'复核 · 确认修复',summary:'审阅 Agent 再次检查同一任务的新版本。',statuses:['waiting','idle','waiting','working'],detail:'模拟修复已通过检查，主管即将汇总结果。'},
  {id:'reporting',title:'汇报 · 给你一个清楚的结论',summary:'主管整理产物、测试结果和剩余风险。',statuses:['working','idle','idle','idle'],detail:'汇报内容包括完成项、测试证据与未验证项，而不只是一句“好了”。'},
  {id:'completed',title:'完成 · 今天也有进展',summary:'任务闭环完成，团队一起庆祝。',statuses:['done','done','done','done'],detail:'演示任务已完成。你可以重播，也可以注入异常，观察阻塞和离线状态。'},
];
export function snapshot(index, fault='none') {
  const stage=stages[Math.max(0,Math.min(stages.length-1,index))];
  return roles.map((role,i)=>({...role,status:fault==='offline'&&role.id==='coder'?'offline':fault==='blocked'&&role.id==='reviewer'?'blocked':stage.statuses[i]}));
}
export const statusLabels={idle:'休息中',working:'工作中',waiting:'等待交接',meeting:'会议中',done:'已完成',blocked:'需要处理',offline:'状态过期'};

// bfcache keeps the document alive: release resources only on a real unload.
export function createPageCleanup(cleanup) {
  let disposed = false;
  return event => { if (event.persisted || disposed) return; disposed = true; cleanup(); };
}

export function roleDetail(index, roleId, fault='none') {
  const states=snapshot(index,fault), role=states.find(r=>r.id===roleId);
  if(!role)return {text:'未识别的角色',artifact:'暂无模拟产物'};
  if(role.status==='offline')return {text:'模拟心跳已超时，无法确认编码角色是否仍在执行。等待恢复状态，不把旧进度当作实时结果。',artifact:'状态未知，不判断产物是否完成'};
  if(role.status==='blocked')return {text:'模拟审阅遇到需要人工处理的问题。当前不允许继续推进，解除异常后再恢复演示。',artifact:'模拟反馈：需要人工确认'};
  if(role.status==='idle')return {text:role.name+'角色当前没有执行中的任务，正在休息区等待下一次交接。',artifact:'当前没有新的模拟产物'};
  if(role.status==='meeting')return {text:role.name+'角色正在参加模拟晨会，确认自己负责的'+role.job+'环节。',artifact:'模拟输入：统一目标与验收标准'};
  if(role.status==='done')return {text:role.name+'角色在这一轮模拟中的职责已经结束。此状态不是对真实代码或模型执行结果的证明。',artifact:'演示结束，没有真实文件产出'};
  if(role.status==='waiting')return {text:role.name+'角色正在等待上游交接，没有独立执行当前阶段。',artifact:'等待模拟任务交接'};
  const work={supervisor:['主管正在汇总本轮模拟中的交付项、检查结果和未验证范围。','模拟产物：交付摘要'],planner:['规划角色正在拆解需求，整理页面、数据结构和验收清单。','模拟产物：任务拆解清单'],coder:[index===4?'编码角色正在按审阅反馈，补充空搜索结果的提示。':'编码角色正在实现模拟的搜索、标签与收藏模块。',index===4?'模拟产物：第二版修复':'模拟产物：第一版实现'],reviewer:[index===5?'审阅角色正在复查修复版本，独立确认此前反馈。':'审阅角色正在独立检查边界条件，本轮将发现空结果提示缺失。',index===5?'模拟产物：复核意见':'模拟产物：审阅反馈']};
  return {text:work[roleId][0],artifact:work[roleId][1]};
}
