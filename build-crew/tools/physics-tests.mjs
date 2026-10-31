import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {initPhysics,Yard,DT,RAPIER} from '../src/physics.mjs';
import {ROUNDS,SANDBOX} from '../src/content.mjs';
import {Mission,evaluate} from '../src/missions.mjs';
import {defaultSave,normalize,normalizeYard,mergeBc} from '../src/meta/save.mjs';
import {solve} from './solution.mjs';
await initPhysics();
const report={};let yard,mission;
const state=()=>({active:yard.active,held:yard.held?.id,blocks:yard.poses(),machines:yard.machines.map(m=>({kind:m.kind,x:m.x,z:m.z,yaw:m.yaw,swing:m.swing,lift:m.lift,reach:m.reach,tip:{...m.tip}})),status:mission.status,complete:mission.complete});
const advance=(axes,n)=>{for(let i=0;i<n;i++){yard.step(axes);mission.step(yard.poses(),yard.held?.id,DT);}return state();};
for(const round of ROUNDS){yard=new Yard(round);mission=new Mission(round);const start=performance.now();await solve({state,advance,action:()=>yard.grab(),select:i=>yard.select(i)},round.id);report[round.id]={simulatedSeconds:Math.round(yard.time),cpuMs:Math.round(performance.now()-start),complete:mission.complete};yard.destroy();console.log(`PASS job ${round.id}`);}
// A tower must remain upright and sleeping without a grab. This is separate from mission flags.
yard=new Yard({...SANDBOX,toys:Array.from({length:8},(_,i)=>({type:'cube',x:5,y:.61+i*1.21,z:5}))});
const t0=performance.now();for(let i=0;i<1200;i++)yard.step();const poses=yard.poses(),maxDrift=Math.max(...poses.map(b=>Math.hypot(b.position.x-5,b.position.z-5)));assert(maxDrift<.15);assert(poses.every((b,i)=>Math.abs(b.position.y-(.6+i*1.2))<.1));report.stack={blocks:8,seconds:20,maxDrift,cpuMs:performance.now()-t0,sleeping:yard.blocks.every(b=>b.body.isSleeping())};assert(report.stack.sleeping);yard.destroy();console.log('PASS stable eight-block stack and sleep');
yard=new Yard(ROUNDS[0]);for(let i=0;i<100;i++)yard.step();assert.equal(yard.grab(),false,'tool cannot grab remotely');const first=yard.blocks[0];first.body.setTranslation({x:yard.tool.x,y:yard.tool.y,z:yard.tool.z},true);assert(yard.grab());yard.step({lift:1});assert.equal(evaluate(ROUNDS[0],yard.poses(),first.id).done,false);yard.resetMachine();assert.equal(yard.held,null);assert(yard.poses().every(b=>Number.isFinite(b.position.y)));yard.destroy();console.log('PASS grab range, held exclusion, recovery');
const a=defaultSave(),b=defaultSave();a.done=[1,2];a.rewards=['cream'];b.done=[1,3];b.rewards=['leaf'];a.play['2026-10-31']={rounds:2,seconds:20};b.play['2026-10-31']={rounds:1,seconds:50};const merged=mergeBc({updatedAt:1,data:a},{updatedAt:2,data:b});assert.deepEqual(merged.done,[1,2,3]);assert.equal(merged.play['2026-10-31'].seconds,50);assert.deepEqual(merged,mergeBc({updatedAt:2,data:b},{updatedAt:1,data:a}));b.resetAt=20;assert.deepEqual(mergeBc({updatedAt:40,data:a},{updatedAt:1,data:b}).done,b.done);assert.equal(normalizeYard({toys:Array(100).fill({type:'cube',x:Infinity})}).toys.length,64);assert.deepEqual(normalize({done:[-2,50,1,1]}).done,[1]);console.log('PASS commutative merge, reset, bounds');
writeFileSync(new URL('../docs/physics-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('All physics and mission checks passed.');
