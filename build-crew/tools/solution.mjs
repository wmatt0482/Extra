// A reusable operator for both Node and browser. It sends only production axes and Grab/Release; never sets a pose.
import { ROUNDS, MACHINES } from '../src/content.mjs';
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export async function solve({state,advance,action,select},id){
  const round=ROUNDS[id-1];let s=await state();
  // Exercise every machine listed for the job, then choose its most capable available tool.
  for(let i=0;i<s.machines.length;i++)await select(i);
  const index=s.machines.findIndex(m=>m.kind===(round.machines.includes('crane')?'crane':round.machines.includes('excavator')?'excavator':'skid'));await select(index);
  const get=async()=>{s=await state();return s.machines[s.active];};
  const tick=async(a,n=12)=>{s=await advance(a,n);};
  async function height(y){for(let i=0;i<100;i++){const m=await get(),diff=y-m.lift;if(Math.abs(diff)<.015)break;await tick({lift:clamp(diff*2)},8);}await tick({},40);}
  async function rotate(yaw){for(let i=0;i<140;i++){const m=await get(),diff=angle(yaw-m.yaw);if(Math.abs(diff)<.008)break;await tick({steer:clamp(diff*1.7)},8);}await tick({},25);}
  async function move(x,z){
    for(let i=0;i<350;i++){const m=await get(),dx=x-m.x,dz=z-m.z,dist=Math.hypot(dx,dz);if(dist<.055)break;const err=angle(Math.atan2(dx,dz)-m.yaw);await tick({steer:clamp(err*1.8),drive:Math.abs(err)<.19?clamp(dist*.65,0,.85):0},10);if(i===349)throw Error(`drive did not arrive at ${x},${z}: ${JSON.stringify(m)}`);}
    await tick({},35);await rotate(0);
  }
  async function route(x,z){let m=await get();await move(m.x,-6.2);await move(x,-6.2);await move(x,z);}
  if((await get()).kind==='crane')await tick({extend:1},100);await height(3.5);await tick({},90);
  const ids=s.blocks.map(b=>b.id);
  for(let i=0;i<ids.length;i++){
    s=await state();const block=s.blocks.find(b=>b.id===ids[i]);if(!block)throw Error('missing toy');const m=await get(),target=round.ghosts?.[i]||{x:2.4+(i%3)*2.6,y:.6,z:3.2+Math.floor(i/3)*2.8};
    await height(m.kind==='skid'?3.5:6.1);await route(block.position.x,block.position.z-m.reach);await height(block.position.y+.04);
    await action('grab');s=await state();if(s.held!==block.id)throw Error(`grab ${id}:${i} missed: ${JSON.stringify({tip:s.machines[s.active].tip,p:block.position,held:s.held})}`);
    await height(m.kind==='skid'?3.5:6.1);await route(target.x,target.z-m.reach);await height(target.y+.15);await tick({},100);if(m.kind==='skid')await tick({tool:1},60);await action('grab');await tick({},40);if(m.kind==='skid'){await tick({drive:-.45},70);await tick({},30);await height(3.5);await tick({tool:-1},60);}await tick({},180);if(typeof process!=='undefined'&&process.env.TRACE)console.log('placed',i,(await state()).blocks.map(b=>b.position));
  }
  await tick({},180);s=await state();if(!s.complete)throw Error(`job ${id} incomplete: ${JSON.stringify(s.status)} poses=${JSON.stringify(s.blocks.map(b=>b.position))}`);return s;
}
