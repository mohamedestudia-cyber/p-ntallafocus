/* Neon Lab · escena 3D cargada bajo demanda. Three.js se importa desde CDN. */
export async function startGame({wrap,mode='free',difficulty=1,onUpdate=()=>{},onEnd=()=>{}}){
  const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js');
  if(!THREE.WebGLRenderer)throw new Error('WebGL no está disponible en este navegador.');
  let renderer,scene,camera,raf,disposed=false,paused=false,score=0,hits=0,level=1,started=performance.now(),last=performance.now(),yaw=0,pitch=0,velocityY=0,onGround=true;
  const keys=new Set(),projectiles=[],targets=[],colliders=[],particles=[];
  const isMobile=matchMedia('(pointer:coarse)').matches;
  const player=new THREE.Group();const clock=new THREE.Clock();
  scene=new THREE.Scene();scene.background=new THREE.Color('#071724');scene.fog=new THREE.Fog('#071724',17,62);
  camera=new THREE.PerspectiveCamera(72,wrap.clientWidth/wrap.clientHeight,.1,100);camera.position.set(0,1.65,0);
  renderer=new THREE.WebGLRenderer({antialias:!isMobile,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.35:1.8));renderer.setSize(wrap.clientWidth,wrap.clientHeight);renderer.shadowMap.enabled=!isMobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;wrap.prepend(renderer.domElement);
  scene.add(new THREE.HemisphereLight('#9bdfff','#15202d',2.0));const key=new THREE.DirectionalLight('#c8ffd4',2.1);key.position.set(7,12,5);key.castShadow=!isMobile;scene.add(key);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#102a38',roughness:.82,metalness:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=0;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(100,70,'#397d80','#244c5a');grid.position.y=.015;scene.add(grid);
  function box(x,y,z,sx,sy,sz,color,emissive=color){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color,roughness:.42,metalness:.5,emissive,emissiveIntensity:.22}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
  // Arquitectura, pilares y límites del escenario.
  for(let i=-4;i<=4;i++){box(i*4,2,-18,1.2,4,1.2,'#173b4a','#174a50');box(i*4,2,18,1.2,4,1.2,'#173b4a','#174a50')}
  for(let z=-14;z<=14;z+=7){box(-19,2,z,1.2,4,1.2,'#173b4a','#174a50');box(19,2,z,1.2,4,1.2,'#173b4a','#174a50')}
  for(let i=0;i<7;i++){const x=(i%4)*8-12,z=-8-Math.floor(i/4)*5;box(x,1.1,z,3.1,2.2,2.4,'#1b4050','#1a5d62')}
  // Avatar geométrico estilizado.
  const suit=new THREE.MeshStandardMaterial({color:'#b4f779',metalness:.6,roughness:.3,emissive:'#315c22',emissiveIntensity:.3});
  const dark=new THREE.MeshStandardMaterial({color:'#163445',metalness:.6,roughness:.35});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.65,4,8),suit);torso.position.y=1.15;player.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.28,16,12),dark);head.position.y=1.85;player.add(head);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.37,.11,.08),new THREE.MeshBasicMaterial({color:'#65f4ef'}));visor.position.set(0,1.9,-.23);player.add(visor);
  for(const x of [-.19,.19]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.43,3,7),dark);leg.position.set(x,.48,0);player.add(leg);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.45,3,7),suit);arm.position.set(x*2,1.22,-.03);arm.rotation.z=x>0?-.15:.15;player.add(arm)}
  const backpack=box(0,1.3,.28,.48,.58,.22,'#256e69','#40d8be');player.add(backpack);backpack.position.set(0,1.3,.28);
  player.position.set(0,0,8);scene.add(player);
  // Objetivos con esfera y anillo; raycast comprueba la línea de visión.
  const targetGeo=new THREE.IcosahedronGeometry(.48,1);
  const targetMat=new THREE.MeshStandardMaterial({color:'#a6ff52',emissive:'#6bff4c',emissiveIntensity:.8,metalness:.35,roughness:.22});
  const targetCount=mode==='attention'?9:mode==='sequence'?9:12;
  for(let i=0;i<targetCount;i++){const g=new THREE.Group();const orb=new THREE.Mesh(targetGeo,targetMat.clone());g.add(orb);const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.035,8,32),new THREE.MeshBasicMaterial({color:'#4ce9e5'}));g.add(ring);g.position.set((Math.random()-.5)*29,1.7+Math.random()*3,-Math.random()*25-2);g.userData={active:true,phase:Math.random()*5,index:i};scene.add(g);targets.push(g)}
  // Plataformas elevadas y paneles de entrenamiento.
  for(let i=0;i<4;i++){const p=box(-12+i*8,.35,-11,3,.7,3,'#17485a','#1c9b9b');p.userData.platform=true}
  const raycaster=new THREE.Raycaster(),center=new THREE.Vector2(0,0),clockStart=performance.now();
  let scoreGoal=mode==='attention'?8:mode==='sequence'?5:10;
  let objective=mode==='attention'?'Localiza y alcanza 8 objetivos':mode==='sequence'?'Activa los paneles luminosos':'Alcanza 10 objetivos de energía';
  onUpdate({score,objective});
  function showToast(t){const el=wrap.querySelector('.game-toast');if(el){el.textContent=t;el.style.opacity='1';setTimeout(()=>{if(el)el.style.opacity='0'},1000)}}
  function fire(){if(disposed||paused||document.hidden)return;camera.updateMatrixWorld();raycaster.setFromCamera(center,camera);const hitscan=raycaster.intersectObjects(targets.filter(t=>t.userData.active).flatMap(t=>t.children),false);if(hitscan.length){const hit=hitscan[0];const target=targets.find(t=>t.children.includes(hit.object));if(target){target.userData.active=false;target.visible=false;score+=10*difficulty;hits++;onUpdate({score,objective:`${hits}/${scoreGoal} objetivos completados`});showToast('+ '+10*difficulty+' PUNTOS');if(hits>=scoreGoal){showToast('¡DESAFÍO COMPLETADO!');finish()}}}
    const dir=new THREE.Vector3();camera.getWorldDirection(dir);const geo=new THREE.SphereGeometry(.09,8,8),mat=new THREE.MeshBasicMaterial({color:'#a6ff52'}),orb=new THREE.Mesh(geo,mat);orb.position.copy(camera.position).addScaledVector(dir,.6);scene.add(orb);projectiles.push({mesh:orb,dir:dir.clone(),life:0});
  }
  function finish(){if(disposed)return;const duration=Math.round((performance.now()-started)/1000);onEnd({score,duration,hits,level,mode});showToast('Sesión guardada');}
  function jump(){if(!paused&&onGround){velocityY=6.5;onGround=false}}
  function interact(){if(paused)return;showToast('NEON LAB · Zona de entrenamiento')}
  function keydown(e){if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&document.activeElement===document.body)e.preventDefault();keys.add(e.code);if(e.code==='Space')jump();if(e.code==='KeyE')interact();if(e.code==='Escape'){document.exitPointerLock?.()}}
  function keyup(e){keys.delete(e.code)}
  function mousemove(e){if(document.pointerLockElement===renderer.domElement&&!isMobile){yaw-=e.movementX*.0022;pitch=Math.max(-1.15,Math.min(1.15,pitch-e.movementY*.0022))}}
  function click(e){if(paused)return;if(!isMobile&&document.pointerLockElement!==renderer.domElement){renderer.domElement.requestPointerLock?.();return}if(e.button===0)fire()}
  function pointerdown(){if(isMobile)return}
  renderer.domElement.addEventListener('click',click);document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);document.addEventListener('mousemove',mousemove);
  const joy=wrap.querySelector('#joystick'),knob=wrap.querySelector('#joy-knob');let joyVec={x:0,y:0},joyId=null;
  if(joy){joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)moveJoy(e)});joy.addEventListener('pointerup',e=>{joyId=null;joyVec={x:0,y:0};knob.style.transform='translate(0,0)'})}
  function moveJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.max(1,Math.hypot(dx,dy)),scale=Math.min(1,36/len);joyVec={x:dx/36*scale,y:dy/36*scale};knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`}
  const look=wrap.querySelector('#touch-look');let lookId=null,lastTouch=null;if(look){look.addEventListener('pointerdown',e=>{lookId=e.pointerId;lastTouch={x:e.clientX,y:e.clientY};look.setPointerCapture(e.pointerId)});look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId||!lastTouch)return;const dx=e.clientX-lastTouch.x,dy=e.clientY-lastTouch.y;yaw-=dx*.008;pitch=Math.max(-1.1,Math.min(1.1,pitch-dy*.008));lastTouch={x:e.clientX,y:e.clientY}});look.addEventListener('pointerup',()=>{lookId=null;lastTouch=null})}
  const touchFire=()=>fire();wrap.querySelector('#touch-fire')?.addEventListener('pointerdown',e=>{e.preventDefault();touchFire()});wrap.querySelector('#touch-jump')?.addEventListener('pointerdown',e=>{e.preventDefault();jump()});wrap.querySelector('#touch-interact')?.addEventListener('pointerdown',e=>{e.preventDefault();interact()});
  function update(dt){const speed=(keys.has('ShiftLeft')?8:5.3)*(difficulty===3?1.08:1);const forward=(keys.has('KeyW')||keys.has('ArrowUp')?-1:0)+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joyVec.y;const side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joyVec.x;const dir=new THREE.Vector3(side,0,forward);if(dir.lengthSq()>1)dir.normalize();dir.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);player.position.addScaledVector(dir,speed*dt);player.position.x=THREE.MathUtils.clamp(player.position.x,-17.5,17.5);player.position.z=THREE.MathUtils.clamp(player.position.z,-17,17);
    velocityY-=16*dt;player.position.y+=velocityY*dt;if(player.position.y<=0){player.position.y=0;velocityY=0;onGround=true}
    player.rotation.y=yaw;camera.position.set(player.position.x,player.position.y+1.65,player.position.z);camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
    targets.forEach(t=>{if(t.userData.active){t.position.y=1.8+Math.sin(clockStart/800+t.userData.phase+performance.now()/900)*.28;t.rotation.y+=dt*.7;t.rotation.x+=dt*.3}});
    for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.mesh.position.addScaledVector(p.dir,23*dt);p.life+=dt;if(p.life>1.1){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();projectiles.splice(i,1)}}
  }
  function loop(now){if(disposed)return;raf=requestAnimationFrame(loop);if(paused||document.hidden){last=now;return}const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);renderer.render(scene,camera)}
  const resize=()=>{if(disposed)return;const w=wrap.clientWidth,h=wrap.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};const ro=new ResizeObserver(resize);ro.observe(wrap);
  function cleanup(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);ro.disconnect();document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);document.removeEventListener('mousemove',mousemove);renderer.domElement.removeEventListener('click',click);if(document.pointerLockElement)document.exitPointerLock?.();projectiles.forEach(p=>{p.mesh.geometry.dispose();p.mesh.material.dispose()});scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});renderer.dispose();renderer.domElement.remove();window.removeEventListener('pf-game-stop',stopHandler);window.removeEventListener('pf-game-pause',pauseHandler);window.removeEventListener('pf-game-resume',resumeHandler);window.removeEventListener('pf-game-jump',jump);window.removeEventListener('pf-game-fire',fire);window.removeEventListener('pf-game-interact',interact);document.removeEventListener('visibilitychange',visibility)}
  function stopHandler(){cleanup()}function pauseHandler(){paused=true;wrap.querySelector('#pause-overlay')?.classList.remove('hidden');document.exitPointerLock?.()}function resumeHandler(){paused=false;last=performance.now();wrap.querySelector('#pause-overlay')?.classList.add('hidden')}function visibility(){if(document.hidden)pauseHandler()}
  window.addEventListener('pf-game-stop',stopHandler);window.addEventListener('pf-game-pause',pauseHandler);window.addEventListener('pf-game-resume',resumeHandler);window.addEventListener('pf-game-jump',jump);window.addEventListener('pf-game-fire',fire);window.addEventListener('pf-game-interact',interact);document.addEventListener('visibilitychange',visibility);
  wrap.querySelector('#game-status')?.textContent;
  raf=requestAnimationFrame(loop);
  // Return a session handle for future extension.
  return {stop:cleanup,pause:pauseHandler,resume:resumeHandler};
}