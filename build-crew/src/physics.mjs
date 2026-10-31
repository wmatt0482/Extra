// The same fixed-step world runs in browsers and Node. Only tools are assisted; toys keep real mass and collisions.
import RAPIER from '../vendor/rapier.mjs';
import { TOYS,MACHINES } from './content.mjs';
export { RAPIER };
let ready;
export const initPhysics=()=>ready ||= RAPIER.init();
export const DT=1/60, MAX_BLOCKS=64;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const qyaw=a=>({x:0,y:Math.sin(a/2),z:0,w:Math.cos(a/2)});
const len=v=>Math.hypot(v.x,v.y,v.z);
export class Yard {
  constructor(round,{onEvent=()=>{}}={}) {
    this.round=round;this.onEvent=onEvent;this.world=new RAPIER.World({x:0,y:-9.81,z:0});
    this.world.timestep=DT;this.world.numSolverIterations=12;this.world.numAdditionalFrictionIterations=8;
    this.queue=new RAPIER.EventQueue(true);this.blocks=[];this.machines=[];this.stamps=[];this.held=null;this.active=0;this.serial=0;this.time=0;this.wrecking=false;this.ball=null;this.ballMachine=null;
    this.tiles=new Map();
    for(let x=-14;x<=14;x+=4)for(let z=-14;z<=14;z+=4)this.tile(x,z,0);
    for(const p of round.props||[])this.fixed(p.x,p.y,p.z,p.size);
    for(const [x,z,s] of [[-17,0,[1,3,35]],[17,0,[1,3,35]],[0,-17,[35,3,1]],[0,17,[35,3,1]]])this.fixed(x,1.5,z,s);
    round.machines.forEach((kind,i)=>this.addMachine(kind,-6+i*5,-4));
    round.toys.forEach(t=>this.spawn(t));
  }
  fixed(x,y,z,size){return this.world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(n=>n/2)).setTranslation(x,y,z).setFriction(.95));}
  tile(x,z,h){const key=`${x},${z}`;if(this.tiles.has(key))this.world.removeCollider(this.tiles.get(key),false);this.tiles.set(key,this.fixed(x,h-1,z,[4,2,4]));}
  addMachine(kind,x,z) {
    const def=MACHINES[kind],body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,.7,z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(1,.65,1.25).setFriction(.8),body);
    const m={kind,body,x,z,y:.7,yaw:0,swing:0,lift:.8,reach:def.reach[0],tilt:0,speed:0,home:{x,z},tool:null,tip:null};
    m.tool=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    if(kind==='skid')for(const [s,p] of [[[2.4,.12,1.3],[0,-.62,0]],[[2.4,.8,.12],[0,-.24,-.62]],[[.12,.7,1.3],[-1.15,-.24,0]],[[.12,.7,1.3],[1.15,-.24,0]]])this.world.createCollider(RAPIER.ColliderDesc.cuboid(...s.map(v=>v/2)).setTranslation(...p).setFriction(.95),m.tool);
    this.machines.push(m);this.updateTip(m,true);return m;
  }
  spawn(t) {
    if(this.blocks.length>=MAX_BLOCKS)return null;
    const d=TOYS[t.type]||TOYS.cube, def={...t,type:TOYS[t.type]?t.type:'cube'};
    const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(t.x,t.y??d.size[1]/2+.1,t.z).setLinearDamping(.45).setAngularDamping(1.8).setCcdEnabled(true));
    if(t.rotation)b.setRotation(t.rotation,true);
    const add=(desc,mass)=>this.world.createCollider(desc.setMass(mass).setFriction(.9).setRestitution(.07).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(130),b);
    if(t.type==='pallet'){
      add(RAPIER.ColliderDesc.cuboid(1,.075,.9).setTranslation(0,.15,0),d.mass/2);
      for(const x of [-.8,.8])add(RAPIER.ColliderDesc.cuboid(.15,.15,.9).setTranslation(x,-.075,0),d.mass/4);
    }else add(d.round?RAPIER.ColliderDesc.cylinder(d.size[1]/2,d.size[0]/2):RAPIER.ColliderDesc.cuboid(...d.size.map(v=>v/2)),d.mass);
    const block={id:++this.serial,type:def.type,color:t.color||'#e65e4b',body:b,home:{...def},born:this.time};
    this.blocks.push(block);return block;
  }
  get machine(){return this.machines[this.active];}
  get tool(){return this.machine.tip;}
  select(i){if(i<0||i>=this.machines.length)return;this.release();this.active=i;this.onEvent({type:'machine',kind:this.machine.kind});}
  hop(){const m=this.machine;const others=this.machines.map((a,i)=>({i,d:Math.hypot(a.x-m.x,a.z-m.z)})).filter(a=>a.i!==this.active).sort((a,b)=>a.d-b.d);if(others.length)this.select(others[0].i);}
  updateTip(m,instant=false){
    const a=m.yaw+m.swing,tip={x:m.x+Math.sin(a)*m.reach,y:m.lift,z:m.z+Math.cos(a)*m.reach};m.tip=tip;
    const q=m.kind==='skid'?{x:Math.cos(a/2)*Math.sin(m.tilt/2),y:Math.sin(a/2)*Math.cos(m.tilt/2),z:-Math.sin(a/2)*Math.sin(m.tilt/2),w:Math.cos(a/2)*Math.cos(m.tilt/2)}:qyaw(a);
    if(instant){m.tool.setTranslation(tip,true);m.tool.setRotation(q,true);}else{m.tool.setNextKinematicTranslation(tip);m.tool.setNextKinematicRotation(q);}
  }
  grab(){
    if(this.held){this.release();return true;}
    const tip=this.tool;
    const pick=this.blocks.map(b=>({b,d:Math.hypot(b.body.translation().x-tip.x,b.body.translation().y-tip.y,b.body.translation().z-tip.z)})).filter(x=>x.d<1.55).sort((a,b)=>a.d-b.d)[0];
    if(!pick)return false;this.held=pick.b;this.held.body.wakeUp();this.onEvent({type:'grab'});return true;
  }
  release(){if(this.held){this.held.body.resetForces(true);this.held.body.resetTorques(true);this.held=null;this.onEvent({type:'release'});}}
  resetMachine(){this.release();const m=this.machine;Object.assign(m,{x:m.home.x,z:m.home.z,yaw:0,swing:0,lift:.8,tilt:0,speed:0,reach:MACHINES[m.kind].reach[0]});m.body.setTranslation({x:m.x,y:.7,z:m.z},true);m.body.setRotation(qyaw(0),true);this.updateTip(m,true);}
  poses(){return this.blocks.map(b=>({id:b.id,type:b.type,color:b.color,position:{...b.body.translation()},rotation:{...b.body.rotation()},velocity:{...b.body.linvel()},angular:{...b.body.angvel()}}));}
  step(input={}){
    const dt=DT,m=this.machine,d=MACHINES[m.kind];this.time+=dt;
    m.speed+=(clamp(input.drive||0,-1,1)*d.speed-m.speed)*.12;
    m.yaw+=clamp(input.steer||0,-1,1)*d.turn*dt;
    const blocked=(x,z)=>(this.round.props||[]).some(p=>Math.abs(x-p.x)<p.size[0]/2+1.15&&Math.abs(z-p.z)<p.size[2]/2+1.3);
    const nx=clamp(m.x+Math.sin(m.yaw)*m.speed*dt,-14,14),nz=clamp(m.z+Math.cos(m.yaw)*m.speed*dt,-14,14);
    if(!blocked(nx,m.z))m.x=nx;if(!blocked(m.x,nz))m.z=nz;
    m.y=.7+this.groundAt(m.x,m.z);
    m.lift=clamp(m.lift+(input.lift||0)*2.2*dt,...d.height);
    if(m.kind==='crane')m.swing+=(input.tool||0)*.8*dt;
    else if(m.kind==='excavator')m.reach=clamp(m.reach+(input.tool||0)*1.8*dt,...d.reach);
    else m.tilt=clamp(m.tilt+(input.tool||0)*dt,-.7,.7);
    m.swing+=(input.swing||0)*dt;m.tilt=clamp(m.tilt+(input.tilt||0)*dt,-.7,.7);
    if(m.kind==='crane')m.reach=clamp(m.reach+(input.extend||0)*1.8*dt,...d.reach);
    m.body.setNextKinematicTranslation({x:m.x,y:m.y,z:m.z});m.body.setNextKinematicRotation(qyaw(m.yaw));
    for(const machine of this.machines)this.updateTip(machine);
    if(this.held){
      const b=this.held.body,p=b.translation(),v=b.linvel(),r=b.rotation(),w=b.angvel(),mass=b.mass(),target={...m.tip};
      // A spring carries weight through contacts. A released toy has no assistance.
      b.resetForces(false);b.resetTorques(false);
      const f={x:(target.x-p.x)*95-v.x*19,y:(target.y-p.y)*95-v.y*19+9.81,z:(target.z-p.z)*95-v.z*19};
      const scale=Math.min(1,230/Math.max(1,len(f)));b.addForce({x:f.x*mass*scale,y:f.y*mass*scale,z:f.z*mass*scale},true);
      const sign=r.w<0?-1:1;b.addTorque({x:(-r.x*sign*28-w.x*9)*mass,y:(-r.y*sign*28-w.y*9)*mass,z:(-r.z*sign*28-w.z*9)*mass},true);
    }
    if(this.ball){const p=this.ball.translation(),v=this.ball.linvel(),t=this.ballMachine.tip,mass=this.ball.mass();this.ball.resetForces(false);this.ball.addForce({x:((t.x-p.x)*18-v.x*3)*mass,y:((t.y-p.y)*18-v.y*3+9.81)*mass,z:((t.z-p.z)*18-v.z*3)*mass},true);}
    this.world.step(this.queue);
    this.queue.drainContactForceEvents(e=>{
      const force=e.totalForceMagnitude();if(force>800)this.onEvent({type:'impact',force});
      if(force>9000)for(const b of this.blocks){if(b.type==='glass'&&this.time-b.born>1&&[e.collider1(),e.collider2()].includes(b.body.collider(0).handle)){this.recover(b);this.onEvent({type:'glitter',position:{...b.body.translation()}});}}
    });
    for(const b of this.blocks){const p=b.body.translation();if(p.y<-6||Math.abs(p.x)>19||Math.abs(p.z)>19)this.recover(b);}
  }
  recover(b){if(this.held===b)this.release();b.body.setTranslation({x:b.home.x,y:b.home.y||2,z:b.home.z},true);b.body.setRotation({x:0,y:0,z:0,w:1},true);b.body.setLinvel({x:0,y:0,z:0},true);b.body.setAngvel({x:0,y:0,z:0},true);b.born=this.time;}
  groundAt(x,z){const s=this.stamps.find(s=>Math.abs(s.x-x)<2&&Math.abs(s.z-z)<2);if(!s)return 0;const l=z-s.z;return s.kind==='pit'?-.9:s.kind==='water'?-.3:s.kind==='ramp'?(l+2)/4*1.8:s.kind==='hill'?(1-Math.abs(l)/2)*1.8:0;}
  stamp(kind,x,z){
    if(this.stamps.length>=12)return false;
    x=clamp(Math.round((x-2)/4)*4+2,-14,14);z=clamp(Math.round((z-2)/4)*4+2,-14,14);
    if(this.stamps.some(s=>s.x===x&&s.z===z))return false;
    const s={kind,x,z};this.stamps.push(s);
    if(kind==='pit'||kind==='water')this.tile(x,z,kind==='pit'?-.9:-.3);
    else {
      const ramp=(offset,angle)=>{const c=RAPIER.ColliderDesc.cuboid(2,.16,kind==='hill'?1.35:2.2).setTranslation(x,.9,z+offset).setRotation({x:Math.sin(angle/2),y:0,z:0,w:Math.cos(angle/2)}).setFriction(1);this.world.createCollider(c);};
      if(kind==='hill'){ramp(-1,-.73);ramp(1,.73);}else ramp(0,-.43);
    }
    this.onEvent({type:'stamp',stamp:s});return true;
  }
  wreck(){if(this.machine.kind!=='crane')return false;if(this.ball){this.world.removeRigidBody(this.ball);this.ball=null;this.ballMachine=null;return true;}this.ballMachine=this.machine;const t=this.tool;this.ball=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(t.x,t.y,t.z).setLinearDamping(.2).setCcdEnabled(true));this.world.createCollider(RAPIER.ColliderDesc.ball(.85).setMass(230),this.ball);return true;}
  snapshot(){return {v:1,toys:this.poses().map(b=>({type:b.type,color:b.color,x:b.position.x,y:b.position.y,z:b.position.z,rotation:b.rotation})),machines:this.machines.map(m=>({kind:m.kind,x:m.x,z:m.z,yaw:m.yaw,swing:m.swing,lift:m.lift,reach:m.reach,tilt:m.tilt})),stamps:this.stamps.map(s=>({...s}))};}
  restore(s){this.release();for(const b of this.blocks)this.world.removeRigidBody(b.body);this.blocks=[];for(const t of s.toys||[])this.spawn(t);for(const st of s.stamps||[])this.stamp(st.kind,st.x,st.z);for(const saved of s.machines||[]){const m=this.machines.find(m=>m.kind===saved.kind);if(m){Object.assign(m,saved);m.body.setTranslation({x:m.x,y:.7,z:m.z},true);m.body.setRotation(qyaw(m.yaw),true);this.updateTip(m,true);}}}
  destroy(){this.queue.free();this.world.free();}
}
