// Pure mission checks: no render, storage or test-only completion path.
import { TOYS } from './content.mjs';
const speed = v => Math.hypot(v?.x||0,v?.y||0,v?.z||0);
export function evaluate(round, blocks, held = null) {
  const eligible = blocks.filter(b=>b.id!==held && !b.broken && speed(b.velocity)<.65 && speed(b.angular)<.7);
  const matches=[];
  if (round.ghosts) {
    const used=new Set();
    for (const g of round.ghosts) {
      const b=eligible.find(b=>!used.has(b.id) && b.type===g.type && Math.hypot(b.position.x-g.x,b.position.z-g.z)<.48 && Math.abs(b.position.y-g.y)<.28 && Math.abs(b.rotation.x)<.16 && Math.abs(b.rotation.z)<.16 && (b.type==='cube'||Math.abs(b.rotation.y)<.16));
      matches.push(b?.id??null); if(b) used.add(b.id);
    }
  } else {
    const p=round.pad;
    for(const b of blocks) {
      const t=TOYS[b.type], margin=Math.hypot(t.size[0],t.size[2])/2;
      matches.push(eligible.includes(b) && Math.abs(b.position.x-p.x)+margin<p.w/2 && Math.abs(b.position.z-p.z)+margin<p.d/2 && b.position.y<4 ? b.id:null);
    }
  }
  return { matches, count:matches.filter(x=>x!==null).length,total:round.ghosts?.length??blocks.length,done:matches.length>0&&matches.every(x=>x!==null) };
}
export class Mission {
  constructor(round){this.round=round;this.settled=0;this.complete=false;this.status={count:0,total:round.ghosts?.length??round.toys.length,matches:[]};}
  step(blocks,held,dt) {this.status=evaluate(this.round,blocks,held);this.settled=this.status.done?this.settled+dt:0;if(this.settled>=.9)this.complete=true;return this.complete;}
}
