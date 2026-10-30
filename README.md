# Agent Office

独立的 AI 虚拟办公室。Vite + Three.js；默认是纯静态模拟演示，可选本地认证后端提供只读 LIVE 观察。网页和观察后端均不调用模型，与 OpenSpace 无代码依赖。

## 本地运行

推荐 Node.js 24：

```sh
npm ci
npm test
npm run dev
```

生产构建：`npm run build`，静态产物位于 `dist/`。`npm run preview` 仅本地预览。

## 已实现

- 原创低多边形办公室：四个工位、会议区、沙发休息区、植物与灯光。
- 主管、规划、编码、审阅四个角色；状态改变时人物移动。
- 八阶段预设模拟任务，支持播放/暂停、重播、下一阶段、跳转阶段。
- 点击 3D 人物或角色卡片查看任务详情。
- 阻塞和心跳超时模拟，异常期间不自动推进。
- 手机布局、键盘可操作角色/阶段按钮、减少动态偏好、WebGL 不可用时保留可操作文字面板。
- 所有依赖打包到静态产物，不依赖运行时 CDN。

## 诚实的状态边界

默认 DEMO 和已部署的静态预览**只有模拟数据**，不会连接真实 Agent 或执行任务。可选 LIVE 模式仅显示认证后端收到的来源报告；既有 DSH run 观察器只查询状态，不派发任务或调用模型。人物动画和来源完成报告都不是独立验收证据。

LIVE 已包含身份验证、心跳过期和运行序号边界。公网实时部署仍未配置，需先确认隐私和访问范围，不能让旧状态永远显示为“工作中”。不要把模型密钥放进网页。

## 代码结构

- `src/office-scene.js`：无框架耦合的 Three.js 场景。
- `src/state.js`：角色、阶段、状态投影，具备 Node 单元测试。
- `src/main.js`：演示控制、角色详情和异常注入。
- `src/style.css`：响应式界面。
- `tests/state.test.mjs`：角色唯一性、独立审阅、异常和边界回归。

场景接口：

```js
const scene = createOfficeScene(element, { onSelect(id) {}, reducedMotion: false });
scene.setAgents([{ id: 'coder', status: 'working' }]);
scene.setCelebrating(false);
scene.resetCamera();
scene.dispose();
```

角色 ID：`supervisor`、`planner`、`coder`、`reviewer`。状态：`idle`、`working`、`waiting`、`meeting`、`done`、`blocked`、`offline`。未提供的角色按离线显示。

## 验证

`npm test` 和 `npm run build` 已通过。云端浏览器已验证文字替代面板及交互，但其 WebGL 被环境禁用，未完成 3D 画面及触屏实际验收。不能把构建成功视为全部浏览器兼容性保证。建议验收桌面及 Android 浏览器：首次加载、拖拽、点击角色、播放暂停、阶段跳转、阻塞/离线、重播，以及 WebGL 不可用时的替代面板。

## 依赖与素材

Three.js（MIT）和 Vite（MIT），版本固定于 package-lock.json。几何模型、场景和页面代码为本项目制作；未复制参考帖的源码或美术资产。没有外部图片、字体、分析脚本或用户数据。

## 独立服务器部署

本项目是静态网页，无数据库、无API密钥、无Agent执行权限。先在隔离构建目录执行 `npm ci && npm test && npm run build`，核验后只发布 `dist/`。

由服务器所有者确认目标主机、独立站点目录、端口或域名后，可让已有静态服务器指向该目录。不要覆盖其他站点、生产配置或开放未批准端口。首次验收可仅监听 localhost 的独立临时端口，再通过已授权通道访问；公网代理、TLS、防火墙和服务自启需单独按主机授权处理。Vite dev/preview 不是长期生产服务。

上线前用桌面和手机检查3D渲染、人物选择、阶段切换、异常状态、返回页面恢复和WebGL降级，并保留上一份静态产物以便原子切换回滚。页面始终应标明模拟数据，不把部署成功说成真实Agent已经接入。

## 手机版（同一网址）

手机会启用专用竖屏布局：更大的角色卡片、两行阶段导航、44px以上主要操作按钮，以及带安全区留白的底部固定播放栏。无需安装APK。

- 单指横向拖动旋转；纵向滑动留给页面滚动。移动超过9px、多指或系统取消手势后，不把拖动误判为人物点击。
- 小屏或粗指针设备限制像素比至1.25、目标30fps、关闭阴影；尊重减少动态偏好。页面隐藏时暂停渲染和演示推进。
- WebGL上下文中断时保留角色面板并提示恢复，恢复后重启画面；若浏览器不支持WebGL仍可使用文字面板。

验证：24个单元测试与生产构建通过；云端浏览器中使用390×700和320×700同源iframe视口验证真实媒体查询、无水平溢出、底栏定位、按钮尺寸、角色选择和离线阻止推进。**这不是实体手机触屏/GPU测试**。云浏览器WebGL被环境禁用，因此3D触控命中、实际帧率及GPU上下文恢复仍需在支持WebGL的手机验收。

## 交互优化

- 角色详情按职责和实际模拟状态展示，休息角色不会显示成正在完成别人的任务；所有产物明确标记为模拟，没有生成真实文件。
- 交接记录只记录本页实际发生的开始、阶段跳转、暂停和异常注入，按浏览器本地时间显示；最多12条，刷新或重播会清空，不伪造真实Agent执行日志。
- 异常期间禁用推进按钮；完成时立即显示重播。暂停同步停止人物动画，完成允许一次有限的庆祝效果。
- 提供标准/慢速节奏和减少动态开关；仅将这两项偏好存入本机localStorage。任务、交接记录、身份凭据都不保存。存储不可用时正常降级。
- 人物转向平滑，选中角色有更清晰的地面标记。真实WebGL画面仍待支持GPU的设备验收。

新增 `src/demo-controller.js` 管理可测试的本地状态转换，`src/input.js` 管理触控和渲染策略。24项单测覆盖异常期间暂停、重播时间、日志上限、偏好白名单、手势边界和完成动画策略。云端手机视口已验证禁用按钮、不同角色详情、偏好刷新保留而任务/日志不保留、完成后立即重播。

### 只读 LIVE 前端（不会启动真实 Agent）

默认仍是 DEMO。本地只读服务启动后，打开其同源页面，切换「只读观察 LIVE」，输入只读访问令牌并明确点击连接。浏览器只读取固定的 `/api/snapshot`，每 3 秒轮询；令牌放在 Authorization 请求头，只保存在连接内存中，不进入 URL、localStorage 或日志。断开、返回 DEMO、离开页面或请求失败都会结束连接；失败后需手动重连。不要在静态预览里输入模型 API 密钥。

LIVE 隐藏演示阶段/异常/播放控件，没有派发、编辑或执行任务入口。心跳与任务进展单独显示；未上报、来源过期、网络断开或超过 10 秒未读到有效响应时，人物显示未知，而不是虚构空闲或进展。显示的是来源报告，不等于独立验收。历史事件仅保留在当前页面内存，服务端也是内存模式。当前静态 Sites 预览没有被连接到此后端；真实模型适配需要后续明确配置与授权。

验证：前端契约/取消与迟到响应/鉴权失败/同源请求/状态过期测试，以及真实本地 HTTP 服务快照兼容性测试。此轮浏览器工具访问被权限检查阻止，未完成新的 DOM、WebGL 或真机触控验收；此前演示版测试不能替代本轮 LIVE 浏览器验收。

### Optional DSH observation

A local, explicit opt-in observer can mirror an **existing** DSH run into the planner role: `node adapters/dsh-observer.mjs --run-id EXISTING_RUN_ID`. It uses private environment credentials, calls only `dsh_status` (no new model turn), and never exposes remote model output to the public demo. It cannot dispatch tasks or call `dsh_run`; creating a real run requires a separate explicit owner request. See [the observation backend documentation](server/README.md#dsh-existing-run-observer-explicit-opt-in) for scoped setup and the verification boundary.

快照隐私边界：前端仅保留约定的角色和事件字段，丢弃额外字段，防止意外附带的后端元数据长期留在视图状态中。这不是网络层脱敏：来源仍须避免在消息或 HTTP 响应中发送秘密。
