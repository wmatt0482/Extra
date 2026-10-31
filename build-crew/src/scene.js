// A lit toy diorama. Repeated toys, contact discs, marks and particles are instanced; no postprocessing.
import * as T from '../vendor/three.module.js';
import { TOYS, MACHINES, COLORS } from './content.mjs';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export class Scene {
  constructor(canvas,{reducedMotion=false}={}){
    this.canvas=canvas;this.reducedMotion=reducedMotion;this.scene=new T.Scene();this.scene.fog=new T.Fog('#dce7d7',65,140);
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    this.camera=new T.PerspectiveCamera(42,1,.1,160);this.target=v(0,0,2);this.yaw=-.68;this.pitch=.77;this.distance=35;this.overview=true;this.daylight=.72;this.sweep=0;this.particleCursor=0;this.particles=[];this.marks=[];this.lastMark=0;this.color=new T.Color();this.tmp=new T.Object3D();this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.machineModels=[];
    this.materials={};this.boxGeo=new T.BoxGeometry(1,1,1);this.cylGeo=new T.CylinderGeometry(.5,.5,1,12);this.sphereGeo=new T.IcosahedronGeometry(1,0);this.circleGeo=new T.CircleGeometry(1,16);
    this.hemi=new T.HemisphereLight('#d3edff','#bd9461',2.3);this.scene.add(this.hemi);
    this.sun=new T.DirectionalLight('#ffe0a2',3.2);this.sun.position.set(-15,30,12);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:80});this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.0002;this.scene.add(this.sun);
    const sky=new T.Mesh(new T.SphereGeometry(120,24,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#8dcbe2')},bottom:{value:new T.Color('#f8e3bc')}},vertexShader:'varying float h; void main(){h=position.y/120.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying float h;uniform vec3 top;uniform vec3 bottom;void main(){gl_FragColor=vec4(mix(bottom,top,smoothstep(-0.1,0.7,h)),1.0);}'}));this.sky=sky;this.scene.add(sky);
    this.static=new T.Group();this.scene.add(this.static);this.yardGroup=new T.Group();this.scene.add(this.yardGroup);this.makeEnvironment();this.batch(this.static);this.batchFloor();
    this.pool=new T.InstancedMesh(this.sphereGeo,this.mat('#e2bd83'),120);this.pool.instanceMatrix.setUsage(T.DynamicDrawUsage);this.pool.frustumCulled=false;this.scene.add(this.pool);this.pool.count=0;
    this.trackPool=new T.InstancedMesh(this.boxGeo,new T.MeshBasicMaterial({color:'#ad8b60',transparent:true,opacity:.22,depthWrite:false}),72);this.trackPool.instanceMatrix.setUsage(T.DynamicDrawUsage);this.trackPool.frustumCulled=false;this.scene.add(this.trackPool);this.trackPool.count=0;
    this.resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/Math.max(1,h);this.camera.updateProjectionMatrix();};window.addEventListener('resize',this.resize);this.resize();
  }
  batchFloor(){
    this.floorTiles=this.yardGroup.children.map(m=>({x:m.position.x,z:m.position.z,color:m.material.color.clone()}));this.yardGroup.clear();
    this.floorMesh=new T.InstancedMesh(this.boxGeo,this.mat('#ffffff'),this.floorTiles.length);this.floorMesh.receiveShadow=true;this.floorMesh.frustumCulled=false;this.floorMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.yardGroup.add(this.floorMesh);this.updateFloor();
  }
  updateFloor(){this.floorTiles.forEach((p,i)=>{const st=this.yard?.stamps.find(s=>s.x===p.x&&s.z===p.z);const h=st?.kind==='pit'?-.9:st?.kind==='water'?-.3:0;this.tmp.position.set(p.x,h-.5,p.z);this.tmp.rotation.set(0,0,0);this.tmp.scale.set(4,1,4);this.tmp.updateMatrix();this.floorMesh.setMatrixAt(i,this.tmp.matrix);this.floorMesh.setColorAt(i,p.color);});this.floorMesh.instanceMatrix.needsUpdate=true;this.floorMesh.instanceColor.needsUpdate=true;}
  batch(group,skip=new Set()){
    group.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(group.matrixWorld).invert(),buckets=new Map();
    group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!skip.has(o)&&[this.boxGeo,this.cylGeo,this.sphereGeo].includes(o.geometry)){const key=o.geometry.uuid+o.material.uuid;let list=buckets.get(key);if(!list){list=[];buckets.set(key,list);}list.push(o);}});
    for(const list of buckets.values()){if(list.length<2)continue;const source=list[0],mesh=new T.InstancedMesh(source.geometry,source.material,list.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;list.forEach((o,i)=>{mesh.setMatrixAt(i,new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));o.removeFromParent();});group.add(mesh);}
  }
  mat(c,extra={}){const key=c+JSON.stringify(extra);return this.materials[key] ||=new T.MeshStandardMaterial({color:c,roughness:.86,metalness:0,...extra});}
  box(parent,x,y,z,sx,sy,sz,c,rot=0){const m=new T.Mesh(this.boxGeo,this.mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  cylinder(parent,x,y,z,r,h,c){const m=new T.Mesh(this.cylGeo,this.mat(c));m.position.set(x,y,z);m.scale.set(r*2,h,r*2);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  ball(parent,x,y,z,r,c){const m=new T.Mesh(this.sphereGeo,this.mat(c));m.position.set(x,y,z);m.scale.setScalar(r);m.castShadow=true;parent.add(m);return m;}
  tree(x,z,s=1){const p=new T.Group();p.position.set(x,0,z);this.static.add(p);this.cylinder(p,0,.9*s,0,.18*s,1.8*s,'#916d4c');for(const [a,b,c,r]of [[0,2.4,0,1.2],[-.65,2.1,.1,.8],[.6,2.6,0,.8]])this.ball(p,a*s,b*s,c*s,r*s,['#719775','#88a877','#adc18c'][Math.floor((x+z+100)%3)]);}
  makeEnvironment(){
    this.box(this.static,0,-1.3,0,250,1,250,'#a8bc88');
    for(let x=-14;x<=14;x+=4)for(let z=-14;z<=14;z+=4){const tile=this.box(this.yardGroup,x,-.5,z,4,1,4,(x+z)%8===0?'#d8bd8c':'#d5b987');tile.name=`tile:${x}:${z}`;}
    this.box(this.static,-23,-.11,2,8,.18,150,'#b2b9ac');for(let z=-60;z<65;z+=7)this.box(this.static,-23,.005,z,.15,.025,2.4,'#f9e8bc');
    // Warm fence with an open gate, tidy workshops and stacks beyond the playable edge.
    for(let i=-16;i<=16;i+=2.8){for(const side of [-1,1]){this.box(this.static,i,.95,side*17,.19,1.9,.19,'#f1dfb5');this.box(this.static,side*17,.95,i,.19,1.9,.19,'#f1dfb5');}for(const y of [.55,1.25]){this.box(this.static,i,y,-17,2.8,.18,.12,'#c3ad80');this.box(this.static,17,y,i,.12,.18,2.8,'#c3ad80');if(i>0||i<-6)this.box(this.static,i,y,17,2.8,.18,.12,'#c3ad80');}}
    this.box(this.static,4,2.3,-23,16,4.6,6,'#e6d9bc');this.box(this.static,4,4.8,-23,17,.45,7,'#5b8284');for(const x of[-1,6]){this.box(this.static,x,1.9,-19.95,4.8,3.8,.1,'#9baca3');for(let y=.45;y<3.8;y+=.45)this.box(this.static,x,y,-19.85,4.5,.04,.04,'#708780');}
    this.box(this.static,12,1.5,-20,2,3,3,'#cb8560');this.box(this.static,12,3.1,-20,2.3,.2,3.3,'#5b8284');this.box(this.static,12,1.9,-18.45,.8,1,.08,'#91b7be');
    for(let i=0;i<22;i++){const a=i*2.399,r=24+(i%5)*3;this.tree(Math.sin(a)*r,Math.cos(a)*r,.8+(i%3)*.18);}
    for(let i=0;i<9;i++){const m=this.ball(this.static,-50+i*14,2,-60,16+(i%3)*5,['#bac6a0','#a9bd9c','#c7cfa9'][i%3]);m.scale.y=.5;m.scale.z=.6;}
    for(const [x,z]of[[-13,-10],[13,10],[13,-13],[-12,13]]){this.box(this.static,x,.08,z,.9,.16,.9,'#eee2be');const cone=new T.Mesh(new T.ConeGeometry(.32,1,8),this.mat('#e38954'));cone.position.set(x,.64,z);cone.castShadow=true;this.static.add(cone);this.cylinder(this.static,x,.7,z,.23,.17,'#fff1cf');}
    // Deterministic small stones and grass outside the maneuvering lanes.
    for(let i=0;i<40;i++){const a=i*1.67,x=Math.sin(a)*(18+i%8),z=Math.cos(a)*(18+i%6);this.ball(this.static,x,.12,z,.16+(i%3)*.09,'#9eaa89');}
    for(let i=0;i<5;i++){this.box(this.static,-13,.32+i*.5,-3,2,.5,1.3,'#bfa078');}
    this.sign=new T.Group();this.static.add(this.sign);this.box(this.sign,-12,1.5,-15,.18,3,.18,'#805d44');this.box(this.sign,-8,1.5,-15,.18,3,.18,'#805d44');this.box(this.sign,-10,2.7,-15,5,1.5,.2,'#304d4a');
    const cv=document.createElement('canvas');cv.width=512;cv.height=128;const c=cv.getContext('2d');c.fillStyle='#304d4a';c.fillRect(0,0,512,128);c.fillStyle='#f9e9bf';c.font='bold 54px sans-serif';c.textAlign='center';c.fillText('BUILD CREW',256,83);const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;const label=new T.Mesh(new T.PlaneGeometry(4.6,1.15),new T.MeshBasicMaterial({map:texture}));label.position.set(-10,2.7,-14.88);this.static.add(label);this.labelTexture=texture;
  }
  clearRound(){if(!this.roundGroup)return;this.scene.remove(this.roundGroup);this.roundGroup.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownGeometry)o.geometry.dispose();if(o.userData.ownMaterial)o.material.dispose();if(o.isLineSegments){o.geometry.dispose();o.material.dispose();}});this.machineModels=[];this.particles=[];this.marks=[];this.pool.count=this.trackPool.count=0;}
  setRound(yard){
    this.clearRound();this.yard=yard;this.roundGroup=new T.Group();this.scene.add(this.roundGroup);this.toyMeshes={};
    for(const kind of Object.keys(TOYS)){
      const d=TOYS[kind],geo=kind==='pipe'?new T.CylinderGeometry(.5,.5,1,12,1,true):d.round?this.cylGeo:this.boxGeo;
      const mat=this.mat(kind==='glass'?'#b7e5dc':'#ffffff',kind==='glass'?{transparent:true,opacity:.5,roughness:.22}:{});
      const m=new T.InstancedMesh(geo,mat,kind==='pallet'?448:64);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;m.count=0;if(kind==='pipe')m.userData.ownGeometry=true;this.roundGroup.add(m);this.toyMeshes[kind]=m;
    }
    this.contacts=new T.InstancedMesh(this.circleGeo,new T.MeshBasicMaterial({color:'#524c32',transparent:true,opacity:.13,depthWrite:false}),64);this.contacts.userData.ownMaterial=true;this.contacts.frustumCulled=false;this.roundGroup.add(this.contacts);
    const pad=yard.round.pad;this.box(this.roundGroup,pad.x,.025,pad.z,pad.w,.035,pad.d,'#709fa4');
    for(const side of[-1,1]){this.box(this.roundGroup,pad.x+side*pad.w/2,.053,pad.z,.12,.035,pad.d,'#dcf3dd');this.box(this.roundGroup,pad.x,.053,pad.z+side*pad.d/2,pad.w,.035,.12,'#dcf3dd');}
    this.ghosts=[];
    for(const g of yard.round.ghosts||[]){const geo=new T.BoxGeometry(...TOYS[g.type].size),mat=new T.MeshBasicMaterial({color:'#a4f0d4',transparent:true,opacity:.2,depthWrite:false});const ghost=new T.Mesh(geo,mat);ghost.position.set(g.x,g.y,g.z);ghost.userData.ownGeometry=true;ghost.userData.ownMaterial=true;this.roundGroup.add(ghost);const edges=new T.LineSegments(new T.EdgesGeometry(geo),new T.LineBasicMaterial({color:'#ceffe3',transparent:true,opacity:.75}));ghost.add(edges);this.ghosts.push(ghost);}
    for(const p of yard.round.props||[]){this.box(this.roundGroup,p.x,p.y,p.z,...p.size,p.kind==='platform'?'#8d9991':'#c5ac86');if(p.kind==='wall')for(let y=.35;y<3;y+=.7)this.box(this.roundGroup,p.x+.31,y,p.z,.025,.035,p.size[2],'#ab916d');}
    if(yard.round.id===8){this.cylinder(this.roundGroup,6,2.5,5,.04,5,'#e7dec2');this.box(this.roundGroup,6.6,4.8,5,1.2,.6,.04,'#de7754');}
    yard.machines.forEach(m=>this.machineModels.push(this.makeMachine(m.kind)));
    this.wreckMesh=new T.Mesh(new T.IcosahedronGeometry(.85,1),this.mat('#495f60',{metalness:.55,roughness:.4}));this.wreckMesh.userData.ownGeometry=true;this.wreckMesh.castShadow=true;this.roundGroup.add(this.wreckMesh);this.wreckMesh.visible=false;
    this.stampGroup=new T.Group();this.roundGroup.add(this.stampGroup);this.syncStamps();
    this.overview=true;this.sweep=0;
  }
  makeMachine(kind){
    const root=new T.Group(),d=MACHINES[kind],c=d.color;this.roundGroup.add(root);const wheels=[];
    this.box(root,0,.65,0,2,.65,2.5,'#344b49');
    if(kind==='skid'){for(const x of[-1.02,1.02])for(const z of[-.85,.85]){const w=this.cylinder(root,x,.58,z,.49,.38,'#3d4940');w.rotation.z=Math.PI/2;wheels.push(w);const hub=this.cylinder(root,x*1.18,.58,z,.23,.025,c);hub.rotation.z=Math.PI/2;}}
    else {for(const x of[-1.05,1.05]){this.box(root,x,.44,0,.48,.68,3.1,'#46514a');for(let z=-1.4;z<1.5;z+=.32)this.box(root,x,.79,z,.54,.09,.13,'#657066');for(const z of[-1,0,1]){const w=this.cylinder(root,x*1.04,.48,z,.3,.51,'#b39c68');w.rotation.z=Math.PI/2;wheels.push(w);}}}
    const cab=new T.Group();root.add(cab);this.box(cab,0,1.1,-.5,1.95,.5,1.75,c);this.box(cab,0,1.85,-.4,1.5,1.5,1.5,c);this.box(cab,0,2.03,.365,1.29,.9,.04,'#7eaeb4');this.box(cab,-.77,2.03,-.4,.04,.9,1.25,'#67999f');this.box(cab,.77,2.03,-.4,.04,.9,1.25,'#67999f');this.box(cab,0,2.65,-.4,1.7,.15,1.7,c);this.cylinder(cab,.65,2.85,-.9,.07,.7,'#495452');
    for(const x of[-.31,.31]){this.ball(cab,x,2.13,.42,.18,'#fbf5db');const eye=this.ball(cab,x,2.14,.56,.085,'#304d4a');eye.scale.z=.35;}
    this.box(cab,0,1.15,-1.4,1.6,.18,.05,'#374744');for(let x=-.65;x<.7;x+=.25)this.box(cab,x,1.14,-1.44,.13,.17,.035,'#f7d66c');
    for(const x of[-.65,.65])this.ball(cab,x,1.15,1,.1,'#fff3cf');
    const decal=this.box(cab,.79,1.6,-.4,.025,.45,.45,'#fff1bf');decal.name='crew-decal';const arms=[];for(let i=0;i<(kind==='skid'?2:4);i++){const a=new T.Mesh(this.boxGeo,this.mat(i%2?'#ead594':c));a.castShadow=true;root.add(a);arms.push(a);}
    const bucket=new T.Group();root.add(bucket);if(kind!=='crane'){this.box(bucket,0,-.56,0,kind==='skid'?2.4:1.5,.15,1.3,c);this.box(bucket,0,-.23,-.6,kind==='skid'?2.4:1.5,.7,.12,c);for(const x of[-1,1])this.box(bucket,x*(kind==='skid'?1.16:.72),-.25,0,.12,.7,1.3,c);for(let x=-.6;x<=.6;x+=.4)this.box(bucket,x,-.55,.76,.18,.15,.45,'#64736c');}
    else{const magnet=this.cylinder(bucket,0,.35,0,.52,.3,'#465e5b');this.cylinder(bucket,0,.55,0,.3,.2,c);}
    const rope=new T.Mesh(this.cylGeo,this.mat('#59625b'));root.add(rope);const hydraulics=[];for(let i=0;i<2;i++){const h=new T.Mesh(this.cylGeo,this.mat('#b7c3b6',{metalness:.5,roughness:.4}));root.add(h);hydraulics.push(h);}
    this.batch(cab,new Set([decal]));this.batch(bucket);this.batch(root,new Set([...arms,rope,...hydraulics,...wheels,decal]));return {root,cab,wheels,arms,bucket,rope,hydraulics,decal};
  }
  segment(mesh,a,b,width=.18){mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(v(0,1,0),b.clone().sub(a).normalize());mesh.scale.set(width,a.distanceTo(b),width);}
  syncMachines(){
    this.yard.machines.forEach((m,i)=>{
      const model=this.machineModels[i],{root,cab,arms,bucket,rope,hydraulics}=model;root.position.set(m.x,m.y-.7,m.z);root.rotation.y=m.yaw;cab.rotation.y=m.kind==='skid'?0:m.swing;
      const tip=v(Math.sin(m.swing)*m.reach,m.lift-(m.y-.7),Math.cos(m.swing)*m.reach);bucket.position.copy(tip);bucket.rotation.set(m.tilt,m.swing,0);
      if(m.kind==='skid'){for(let k=0;k<2;k++)this.segment(arms[k],v(k? .9:-.9,1.4,-.5),tip.clone().add(v(k?.9:-.9,-.1,-.5)),.18);rope.visible=false;}
      else if(m.kind==='excavator'){
        const elbow=v(Math.sin(m.swing)*m.reach*.38,Math.max(3.5,m.lift+1.8),Math.cos(m.swing)*m.reach*.38),base=v(0,1.7,.3);
        this.segment(arms[0],base,elbow,.4);this.segment(arms[1],elbow,tip,.3);arms[2].visible=arms[3].visible=false;this.segment(hydraulics[0],base.clone().add(v(.3,.2,0)),elbow.clone().add(v(.3,-.3,0)),.08);this.segment(hydraulics[1],elbow.clone().add(v(-.2,-.2,0)),tip.clone().add(v(-.2,.4,0)),.07);rope.visible=false;
      }else{
        const top=v(Math.sin(m.swing)*m.reach,Math.max(8,m.lift+2),Math.cos(m.swing)*m.reach),base=v(0,2,0);this.segment(arms[0],base,top,.42);this.segment(arms[1],base.clone().add(v(.35,0,0)),top.clone().add(v(.35,0,0)),.15);this.segment(arms[2],base.clone().add(v(-.35,0,0)),top.clone().add(v(-.35,0,0)),.15);arms[3].visible=false;this.segment(rope,top,tip.clone().add(v(0,.5,0)),.045);this.segment(hydraulics[0],v(0,1.5,1),top.clone().multiplyScalar(.4),.12);hydraulics[1].visible=false;
      }
      model.decal.visible=this.decal!=='none'&&!!this.decal;model.decal.rotation.x=this.decal==='star'?Math.PI/4:0;model.wheels.forEach(w=>w.rotation.x+=m.speed*.02);
      if(m.kind==='skid')hydraulics.forEach((h,k)=>this.segment(h,v(k?.9:-.9,1.1,0),tip.clone().add(v(k?.9:-.9,0,-.5)),.08));
      if(this.paint&&this.paint!=='stock'){const paint={cream:'#e8d9b1',leaf:'#8bb582',sky:'#79afb8',sunset:'#eaa07c'}[this.paint];if(paint)for(const a of arms)a.material=this.mat(paint);}
    });
  }
  syncStamps(){
    if(!this.stampGroup)return;this.stampGroup.clear();this.updateFloor();
    for(const tile of this.yardGroup.children){if(tile.name.startsWith('tile:'))tile.position.y=-.5;}
    for(const s of this.yard.stamps){const tile=this.yardGroup.getObjectByName(`tile:${s.x}:${s.z}`);if(s.kind==='pit'||s.kind==='water'){if(tile)tile.position.y=-.5+(s.kind==='pit'?-.9:-.3);if(s.kind==='water')this.box(this.stampGroup,s.x,-.08,s.z,3.9,.05,3.9,'#73b4bd');for(const x of[-1,1]){this.box(this.stampGroup,s.x+x*1.96,-.45,s.z,.08,.9,4,'#b29c72');this.box(this.stampGroup,s.x,-.45,s.z+x*1.96,4,.9,.08,'#b29c72');}}else{const wedge=(offset,rot)=>{const ramp=this.box(this.stampGroup,s.x,.9,s.z+offset,4,.32,s.kind==='hill'?2.7:4.4,'#baa478');ramp.rotation.x=rot;};if(s.kind==='hill'){wedge(-1,-.73);wedge(1,.73);}else wedge(0,-.43);}}
  }
  daylightTo(n){this.daylight=n;this.sun.intensity=.25+n*3.8;this.hemi.intensity=.65+n*2.2;this.sun.color.set(n<.4?'#e7a9bd':'#ffe1ab');this.sky.material.uniforms.top.value.set(n<.35?'#243e68':'#8dcbe2');this.sky.material.uniforms.bottom.value.set(n<.35?'#9f9ba4':'#f8e3bc');}
  emit(position,color='#ddc196',count=8){if(this.reducedMotion)return;for(let i=0;i<count;i++){this.particles.push({p:v(position.x,position.y,position.z),v:v(Math.sin(i*2.4)*1.3,.6+(i%3)*.65,Math.cos(i*2.4)*1.3),life:.8+(i%3)*.2,color,size:.1+(i%3)*.05});}if(this.particles.length>120)this.particles.splice(0,this.particles.length-120);}
  celebrate(){this.sweep=this.reducedMotion?0:5;const p=this.yard.round.pad;for(let i=0;i<5;i++)this.emit({x:p.x+(i-2)*1.2,y:4,z:p.z},COLORS[i],18);}
  orbit(dx,dy){this.yaw-=dx*.006;this.pitch=Math.max(.25,Math.min(1.25,this.pitch+dy*.004));}
  zoom(delta){this.distance=Math.max(12,Math.min(52,this.distance+delta));}
  groundPoint(e){const rect=this.canvas.getBoundingClientRect();this.ndc.set((e.clientX-rect.x)/rect.width*2-1,-((e.clientY-rect.y)/rect.height)*2+1);this.ray.setFromCamera(this.ndc,this.camera);return this.ray.ray.intersectPlane(new T.Plane(v(0,1,0),0),v());}
  render(dt,status){
    if(!this.yard)return;const poses=this.yard.poses(),counts=Object.fromEntries(Object.keys(TOYS).map(k=>[k,0]));
    poses.forEach((b,i)=>{const d=TOYS[b.type],mesh=this.toyMeshes[b.type];this.tmp.position.copy(b.position);this.tmp.quaternion.copy(b.rotation);this.tmp.scale.set(...d.size);this.tmp.updateMatrix();
      if(b.type==='pallet'){
        for(let k=0;k<7;k++){const local=new T.Matrix4().compose(v(k<5?-.84+k*.42:(k===5?-.8:.8),k<5?.15:-.075,0),new T.Quaternion(),v(k<5?.3:.3,k<5?.15:.3,1.8));const matrix=new T.Matrix4().compose(v(b.position.x,b.position.y,b.position.z),new T.Quaternion(b.rotation.x,b.rotation.y,b.rotation.z,b.rotation.w),v(1,1,1));matrix.multiply(local);mesh.setMatrixAt(counts[b.type],matrix);mesh.setColorAt(counts[b.type]++,this.color.set('#b38c5c'));}
      }else{mesh.setMatrixAt(counts[b.type],this.tmp.matrix);mesh.setColorAt(counts[b.type]++,this.color.set(b.color));}
      this.tmp.position.set(b.position.x,.065+this.yard.groundAt(b.position.x,b.position.z),b.position.z);this.tmp.rotation.set(-Math.PI/2,0,0);this.tmp.scale.set(d.size[0]*.65,d.size[2]*.65,1);this.tmp.updateMatrix();this.contacts.setMatrixAt(i,this.tmp.matrix);
    });
    for(const [kind,m]of Object.entries(this.toyMeshes)){m.count=counts[kind];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}this.contacts.count=poses.length;this.contacts.instanceMatrix.needsUpdate=true;
    this.ghosts.forEach((g,i)=>{const good=status?.matches?.[i]!=null;g.material.color.set(good?'#91f38a':'#adf6e1');g.material.opacity=good?.33:.16+Math.sin(this.yard.time*2)*.04;});
    this.syncMachines();
    const m=this.yard.machine;
    if(!this.reducedMotion&&Math.abs(m.speed)>.3&&this.yard.time-this.lastMark>.24){this.lastMark=this.yard.time;if(this.marks.length%3===0)this.emit({x:m.x+.45,y:m.y+2.3,z:m.z-.8},'#c4c9b3',1);this.marks.push({x:m.x,z:m.z,yaw:m.yaw});if(this.marks.length>36)this.marks.shift();if(Math.abs(m.speed)>1)this.emit(m.kind!=='crane'&&m.lift<1?{x:m.tip.x,y:.2,z:m.tip.z}:{x:m.x,y:.25,z:m.z-1},'#d7ba85',1);}
    this.marks.forEach((p,i)=>{for(let k=0;k<2;k++){this.tmp.position.set(p.x+(k?.85:-.85)*Math.cos(p.yaw),.035+this.yard.groundAt(p.x,p.z),p.z);this.tmp.rotation.set(0,p.yaw,0);this.tmp.scale.set(.3,.012,.6);this.tmp.updateMatrix();this.trackPool.setMatrixAt(i*2+k,this.tmp.matrix);}});this.trackPool.count=this.marks.length*2;this.trackPool.instanceMatrix.needsUpdate=true;
    this.particles=this.particles.filter(p=>p.life>0);this.particles.forEach((p,i)=>{p.life-=dt;p.p.addScaledVector(p.v,dt);p.v.y-=dt*1.4;this.tmp.position.copy(p.p);this.tmp.rotation.set(i*.8,i,0);this.tmp.scale.setScalar(p.size*Math.max(0,p.life));this.tmp.updateMatrix();this.pool.setMatrixAt(i,this.tmp.matrix);this.pool.setColorAt(i,this.color.set(p.color));});this.pool.count=this.particles.length;this.pool.instanceMatrix.needsUpdate=true;if(this.pool.instanceColor)this.pool.instanceColor.needsUpdate=true;
    this.wreckMesh.visible=!!this.yard.ball;if(this.yard.ball)this.wreckMesh.position.copy(this.yard.ball.translation());
    const desired=this.overview?v(0,0,1):v(m.x*.45+this.yard.round.pad.x*.3,1,m.z*.45+this.yard.round.pad.z*.3);if(this.sweep>0){this.sweep-=dt;this.yaw+=dt*.15;desired.set(this.yard.round.pad.x,1,this.yard.round.pad.z);}
    this.target.lerp(desired,this.reducedMotion?1:1-Math.exp(-dt*3));const dist=(this.overview?Math.max(35,this.distance):this.distance)*(this.camera.aspect<.8?Math.min(1.5,.85/this.camera.aspect):1);
    this.camera.position.set(this.target.x+Math.sin(this.yaw)*Math.cos(this.pitch)*dist,this.target.y+Math.sin(this.pitch)*dist,this.target.z+Math.cos(this.yaw)*Math.cos(this.pitch)*dist);this.camera.lookAt(this.target);this.renderer.render(this.scene,this.camera);
  }
  thumbnail(){this.render(0);const cv=document.createElement('canvas');cv.width=320;cv.height=180;cv.getContext('2d').drawImage(this.canvas,0,0,320,180);return cv.toDataURL('image/jpeg',.65);}
  adapt(ms){this.slowFrames=ms>18?(this.slowFrames||0)+1:Math.max(0,(this.slowFrames||0)-1);if(this.slowFrames>45&&this.renderer.getPixelRatio()>1){this.renderer.setPixelRatio(1);this.resize();}}
  destroy(){window.removeEventListener('resize',this.resize);this.clearRound();const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.labelTexture.dispose();this.renderer.dispose();}
}
