import * as THREE from 'three';
import {createPointerGesture,renderProfile} from './input.js';

/** Standalone renderer. All states are supplied by the caller; no network or AI calls. */
export function createOfficeScene(container, { onSelect = () => {}, onRenderState = () => {}, reducedMotion = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e4d9');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  let profile=renderProfile({width:container.clientWidth,coarse:matchMedia('(pointer: coarse)').matches,dpr:devicePixelRatio||1,reducedMotion});
  renderer.setPixelRatio(profile.pixelRatio);
  renderer.shadowMap.enabled = profile.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '可旋转的 AI 虚拟办公室，点击人物查看状态');
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  let yaw = .75, pitch = .78, distance = 19, targetYaw = yaw;
  const aim = new THREE.Vector3(0, .3, 0);
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x718379, 2.7));
  const sun = new THREE.DirectionalLight(0xfff3dc, 3.6);
  sun.position.set(-5, 12, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left:-9,right:9,top:9,bottom:-9,near:1,far:30});
  sun.shadow.normalBias = .03; scene.add(sun);
  const materials = new Map();
  const mat = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color, roughness:.82})); return materials.get(color); };
  function box(w,h,d,color,x,y,z,parent=scene,r=0) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));
    m.position.set(x,y,z); m.rotation.y=r; m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
  }
  function cylinder(rt,rb,h,color,x,y,z,parent=scene,segments=12) {
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat(color));
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
  }
  function sphere(radius,color,x,y,z,parent=scene) {
    const m=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),mat(color)); m.position.set(x,y,z); m.castShadow=true; parent.add(m); return m;
  }
  function label(text,x,z,color='#52604f',size=1.5) {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=96;
    const ctx=canvas.getContext('2d'); ctx.font='600 38px sans-serif'; ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,62);
    const tex=new THREE.CanvasTexture(canvas); const material=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});
    const sprite=new THREE.Sprite(material); sprite.position.set(x,.17,z);sprite.scale.set(size,size*96/512,1);scene.add(sprite);
  }
  // A miniature architectural cutaway, intentionally open towards the viewer.
  box(11,.35,8.5,'#bfae92',0,-.2,0);
  box(10.8,.08,8.3,'#f0e7d6',0,0,0);
  for(let x=-5;x<5.4;x+=.55) box(.014,.01,8.1,'#dacdb8',x,.05,0);
  box(11,1.8,.16,'#d5d9c8',0,.9,-4.2);
  box(.16,1.8,8.5,'#d5d9c8',-5.45,.9,0);
  // Window mullions and a view out to the morning sky.
  box(3.5,1.2,.05,'#add0d1',-2,1.05,-4.09);
  for(const x of [-3.75,-2,-.25]) box(.07,1.3,.08,'#f8f3e7',x,1.05,-4.02);
  box(3.6,.07,.08,'#f8f3e7',-2,1.05,-4.01);
  box(2,.85,.06,'#f6eedc',3.1,1.16,-4.07);
  for(let i=0;i<3;i++) box(.42,.08,.02,['#6e8d78','#d4a364','#7d9cac'][i],2.6+i*.48,1.13,-4.02);
  // Work zone.
  box(6.2,.025,3.9,'#c3cbb5',.7,.065,-1.15);
  const roleDefs=[['supervisor','#aa744e',[-1.2,-2.45]],['planner','#699687',[1.55,-2.45]],['coder','#668caa',[-1.2,.1]],['reviewer','#a68cb0',[1.55,.1]]];
  for(const [,color,[x,z]] of roleDefs) {
    box(2.05,.13,1.08,'#e5b77e',x,.91,z);
    for(const dx of [-.82,.82])for(const dz of [-.35,.35]) box(.09,.86,.09,'#f3f1e7',x+dx,.46,z+dz);
    box(.79,.48,.065,'#354b47',x,1.23,z-.17);
    box(.68,.36,.02,'#98c1b4',x,1.24,z-.126);
    for(let j=0;j<3;j++) box(.30+j*.08,.025,.015,'#daefcc',x-.1,1.34-j*.08,z-.109);
    box(.06,.17,.06,'#354b47',x,1,z-.17);
    box(.63,.035,.25,'#d5d9c8',x,.995,z+.25);
    cylinder(.09,.08,.19,'#f5f2e8',x+.69,1.06,z+.19);
    box(.55,.12,.55,color,x,.54,z+.95);box(.55,.47,.1,color,x,.79,z+1.16);
    cylinder(.04,.06,.5,'#4a5750',x,.25,z+.95);
  }
  // Lounge: terracotta couch, rug and coffee table.
  box(2.4,.025,2.3,'#ddd2bc',-3.6,.065,2.25);
  box(1.75,.45,.7,'#cb8866',-3.5,.35,2.9); box(1.75,.7,.22,'#cb8866',-3.5,.65,3.28);
  box(.22,.65,.83,'#b77455',-4.39,.45,2.91);box(.22,.65,.83,'#b77455',-2.61,.45,2.91);
  cylinder(.53,.53,.12,'#f2e5c8',-3.5,.44,1.72); cylinder(.12,.19,.4,'#b6a48b',-3.5,.2,1.72);
  box(.3,.05,.21,'#728e79',-3.5,.53,1.72);
  // Meeting corner.
  box(2.7,.025,2.6,'#d0d9d1',3.65,.065,2.2);
  cylinder(.83,.83,.13,'#e9bb83',3.55,.88,2.15,scene,32);cylinder(.17,.27,.8,'#f0ecdf',3.55,.42,2.15);
  for(let i=0;i<4;i++){const a=i*Math.PI/2; const x=3.55+Math.cos(a)*1.1,z=2.15+Math.sin(a)*1.1;box(.42,.12,.42,'#739181',x,.48,z);cylinder(.05,.08,.44,'#627369',x,.22,z);}
  // Plants, cabinet and lamps.
  function plant(x,z,scale=1){cylinder(.21*scale,.15*scale,.36*scale,'#bd8b68',x,.22*scale,z);cylinder(.025,.025,.55*scale,'#657e4e',x,.65*scale,z);for(let i=0;i<5;i++){const a=i*2.4;const s=sphere(.22*scale,i%2?'#71946c':'#52785c',x+Math.sin(a)*.17*scale,.7*scale+(i%2)*.17,z+Math.cos(a)*.17*scale);s.scale.set(.8,1.3,.7);}}
  plant(-4.8,-3.4,1.6);plant(4.7,-3.5,1.5);plant(-4.7,3.5,.8);
  box(.85,1.1,1.9,'#c5b698',-4.8,.58,-.4);
  for(let i=0;i<5;i++)box(.4,.13,.12,['#789389','#bc8c64','#d5b98a'][i%3],-4.62,1.2+i*.13,-.85);
  label('WORK ZONE',.4,-3.55,'#5a705b',1.9);label('LOUNGE',-3.5,3.9,'#7f6a58',1.4);label('MEETING',3.5,3.9,'#5c7567',1.5);
  const agents=new Map(); const pickables=[];
  for(const [id,color,desk] of roleDefs){
    const group=new THREE.Group(); scene.add(group);
    const body=box(.35,.43,.25,color,0,.75,0,group);
    sphere(.22,'#e5b998',0,1.13,0,group);const hair=sphere(.225,'#3a4140',0,1.22,-.025,group);hair.scale.y=.55;
    const left=box(.1,.37,.12,'#364c48',-.11,.36,0,group),right=box(.1,.37,.12,'#364c48',.11,.36,0,group);
    box(.09,.32,.1,color,-.24,.76,0,group);box(.09,.32,.1,color,.24,.76,0,group);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.34,.39,32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.12;group.add(ring);
    const beacon=sphere(.07,'#d1e6b2',0,1.57,0,group);
    group.position.set(desk[0],.08,desk[1]+.9);
    group.traverse(o=>{if(o.isMesh){o.userData.agentId=id;pickables.push(o);}});
    agents.set(id,{group,body,left,right,beacon,ring,desk,status:'idle',target:new THREE.Vector3(desk[0],.08,desk[1]+.9)});
  }
  const confetti=[];
  for(let i=0;i<38;i++){const m=box(.055,.12,.02,['#c1906d','#8fb09d','#e6bf62','#9a8bb6'][i%4],0,-10,0);m.visible=false;confetti.push(m);}
  let celebrating=false, celebrationStart=0, paused=false, animationTime=0, disposed=false, raf=0, last=performance.now();
  const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
  const gesture=createPointerGesture();let dragYaw=targetYaw,contextLost=false;
  const down=e=>{if(gesture.start(e)){dragYaw=targetYaw;renderer.domElement.setPointerCapture?.(e.pointerId);}};
  const move=e=>{const movement=gesture.move(e);if(movement?.horizontal&&movement.moved)targetYaw=dragYaw-movement.dx*.008;};
  const up=e=>{const tap=gesture.end(e);if(renderer.domElement.hasPointerCapture?.(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);if(tap){const b=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables)[0];if(hit)onSelect(hit.object.userData.agentId);}};
  const cancel=()=>gesture.cancel();
  const lost=e=>{e.preventDefault();contextLost=true;cancelAnimationFrame(raf);gesture.cancel();onRenderState('recovering');};
  const restored=()=>{if(disposed)return;contextLost=false;last=performance.now();onRenderState('ready');raf=requestAnimationFrame(tick);};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('lostpointercapture',cancel);renderer.domElement.addEventListener('webglcontextlost',lost);renderer.domElement.addEventListener('webglcontextrestored',restored);
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;profile=renderProfile({width:w,coarse:matchMedia('(pointer: coarse)').matches,dpr:devicePixelRatio||1,reducedMotion});renderer.setPixelRatio(profile.pixelRatio);renderer.shadowMap.enabled=profile.shadows;renderer.setSize(w,h);camera.aspect=w/h;distance=w/h<1?24:19;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function tick(now){if(disposed||contextLost)return;if(document.hidden||now-last<1000/profile.fps){raf=requestAnimationFrame(tick);return;}const dt=Math.min((now-last)/1000,.05);last=now;if(!paused)animationTime+=dt*1000;yaw+=(targetYaw-yaw)*(reducedMotion?1:.12);camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(aim);
    let i=0;for(const a of agents.values()){const delta=a.target.clone().sub(a.group.position);const moving=delta.length()>.035;if(reducedMotion)a.group.position.copy(a.target);else if(!paused)a.group.position.addScaledVector(delta,Math.min(1,dt*2.2));if(!paused){const heading=moving&&!reducedMotion?Math.atan2(delta.x,delta.z):a.status==='working'?Math.PI:0;const turn=Math.atan2(Math.sin(heading-a.group.rotation.y),Math.cos(heading-a.group.rotation.y));a.group.rotation.y+=turn*(reducedMotion?1:Math.min(1,dt*8));}
      if(!paused){const swing=moving&&!reducedMotion?Math.sin(animationTime*.012+i)*.38:0;a.left.rotation.x=swing;a.right.rotation.x=-swing;a.body.rotation.x=a.status==='working'&&!reducedMotion?Math.sin(animationTime*.005+i)*.035:0;}
      a.beacon.visible=a.status!=='offline';a.beacon.material=mat(a.status==='blocked'?'#df795e':a.status==='working'?'#c7e7a8':'#d2d5c9');i++;}
    for(let j=0;j<confetti.length;j++){const c=confetti[j];c.visible=celebrating&&!reducedMotion&&animationTime-celebrationStart<4500;if(c.visible){const t=((animationTime-celebrationStart)/1000+j*.043)%2.5;c.position.set(Math.sin(j*4.3)*4,4-t*1.5,Math.cos(j*2.7)*3);c.rotation.set(t+j,t*2,j);}}
    renderer.render(scene,camera);raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);
  return {
    setAgents(states){let i=0;for(const [id,a] of agents){const state=states.find(s=>s.id===id),changed=a.status!==(state?.status||'offline');a.status=state?.status||'offline';let x=a.desk[0],z=a.desk[1]+.9;
      if(a.status==='idle'||a.status==='offline'){x=-4.25+i*.48;z=2.6;}
      if(a.status==='meeting'){const angle=i*Math.PI/2;x=3.55+Math.cos(angle)*1.1;z=2.15+Math.sin(angle)*1.1;}
      if(a.status==='waiting'){x=3.4;z=-2.9+i*.55;}
      if(a.status==='done'){x=-.7+i*.5;z=2.7;}
      a.target.set(x,.08,z);if(paused&&changed)a.group.position.copy(a.target);i++;}},
    setCelebrating(value){if(value&&!celebrating)celebrationStart=animationTime;celebrating=value;},
    setPaused(value){paused=!!value;},
    setReducedMotion(value){reducedMotion=!!value;resize();},
    setSelected(id){for(const [key,a] of agents){a.ring.material.transparent=true;a.ring.material.opacity=key===id?1:.4;a.ring.scale.setScalar(key===id?1.35:1);}},
    resetCamera(){targetYaw=.75;},
    dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',cancel);renderer.domElement.removeEventListener('lostpointercapture',cancel);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('webglcontextrestored',restored);const geometries=new Set(),usedMaterials=new Set(materials.values()),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){usedMaterials.add(m);if(m.map)textures.add(m.map);}}});for(const g of geometries)g.dispose();for(const t of textures)t.dispose();for(const m of usedMaterials)m.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
