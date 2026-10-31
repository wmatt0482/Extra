// First-flight data only. The other sites and machines live in SPEC.md until implemented.
export const VERSION = '0.2.0';
export const COLORS = ['#c6412f', '#e9aa26', '#287da5', '#64816b', '#87909c'];
export const TOYS = {
  cube: { name: 'Cube', size: [1.2, 1.2, 1.2], mass: 24 },
  beam: { name: 'Beam', size: [4, .65, 1.15], mass: 55 },
  slab: { name: 'Slab', size: [3.7, .55, 3.7], mass: 67 },
  pallet: { name: 'Pallet', size: [2, .45, 1.8], mass: 34 },
  barrel: { name: 'Barrel', size: [1.1, 1.5, 1.1], mass: 29, round: true },
  pipe: { name: 'Pipe', size: [1, 2.2, 1], mass: 38, round: true },
  glass: { name: 'Glass', size: [2, 1.8, .25], mass: 14, fragile: true },
};
export const MACHINES = {
  skid: { name: 'SS-01', label: 'Skid steer', color: '#e9aa26', speed: 3.1, turn: 1.6, height: [0.7, 3.8], reach: [2.7, 2.7], hint: 'WASD or the left stick drives. This skid steer turns on the spot.' },
  excavator: { name: 'EX-02', label: 'Excavator', color: '#d75a29', speed: 2.1, turn: 1.1, height: [.7, 6.2], reach: [2.6, 6], hint: 'Lift with I or the right stick. J and L reach out and in.' },
  crane: { name: 'CR-03', label: 'Crane', color: '#d5dce2', speed: 1.8, turn: .85, height: [.7, 10], reach: [3.5, 9], hint: 'I and K lift the magnet. J and L swing the boom.' },
};
const toy = (x,z,type='cube',color=COLORS[0]) => ({ type, color, x, y: TOYS[type].size[1]/2 + .08, z });
const ghost = (x,y,z,type='cube') => ({x,y,z,type});
const supply = (n,type='cube') => Array.from({length:n},(_,i)=>toy(-6+(i%3)*2.7,3+Math.floor(i/3)*3,type));
const base = {site:'yard', pad:{ x:5,z:5,w:8,d:8 }, props:[]};
export const ROUNDS = [
  {...base,id:1,title:'Cargo transfer',goal:'Transfer three red loads to the blue delivery zone.',machines:['skid'],toys:supply(3),reward:'Limestone paint',unlock:'cream'},
  {...base,id:2,title:'Bulk handling',goal:'Transfer all six red loads to the blue delivery zone.',machines:['skid'],toys:supply(6),reward:'EX-02 excavator',unlock:'excavator'},
  {...base,id:3,title:'Foundation grid',goal:'Place the three blocks on their glowing outlines.',machines:['excavator'],toys:supply(3),ghosts:[ghost(3,.6,5),ghost(5,.6,5),ghost(7,.6,5)],reward:'Forest paint',unlock:'leaf'},
  {...base,id:4,title:'Wall assembly',goal:'Assemble a two-layer wall on the blueprint.',machines:['excavator'],toys:supply(4),ghosts:[ghost(3,.6,5),ghost(4.25,.6,5),ghost(3,1.8,5),ghost(4.25,1.8,5)],reward:'Star decal',unlock:'star'},
  {...base,id:5,title:'Bridge span',goal:'Place two supports and a beam to make a bridge.',machines:['skid','excavator'],toys:[toy(-6,3),toy(-3,3),toy(-5,7,'beam')],ghosts:[ghost(2,.6,5),ghost(5,.6,5),ghost(3.5,1.525,5,'beam')],reward:'CR-03 crane',unlock:'crane'},
  {...base,id:6,title:'High lift',goal:'Lift three blocks onto the high blue platform.',machines:['crane'],toys:supply(3),ghosts:[ghost(2,4.6,5),ghost(4,4.6,5),ghost(6,4.6,5)],props:[{x:4,y:2,z:5,size:[7,4,3.2],kind:'platform'}],reward:'Steel blue paint',unlock:'sky'},
  {...base,id:7,title:'Over the wall',goal:'Lift four red loads over the barrier into the delivery zone.',machines:['crane','skid'],toys:[toy(-5,3),toy(-5,6),toy(-8,3),toy(-8,6)],props:[{x:-.5,y:1.6,z:5,size:[.6,3.2,11],kind:'wall'}],reward:'Bell horn',unlock:'bell'},
  {...base,id:8,title:'High stack',goal:'Stack four blocks to reach the height marker.',machines:['excavator'],toys:supply(4),ghosts:[0,1,2,3].map(i=>ghost(4,.6+1.2*i,5)),reward:'Stripe decal',unlock:'stripe'},
  {...base,id:9,title:'Portal frame',goal:'Build two tall legs and rest the beam on top.',machines:['crane','excavator'],toys:[...supply(4),toy(-5,9,'beam')],ghosts:[ghost(2,.6,5),ghost(5,.6,5),ghost(2,1.8,5),ghost(5,1.8,5),ghost(3.5,2.725,5,'beam')],reward:'Sunset paint',unlock:'sunset'},
  {...base,id:10,title:'Water tower',goal:'Build four legs and lift the tank onto the top.',machines:['skid','excavator','crane'],toys:[...supply(4),toy(-5,9,'slab')],ghosts:[ghost(2,.6,4),ghost(4.5,.6,4),ghost(2,.6,6.5),ghost(4.5,.6,6.5),ghost(3.25,1.475,5.25,'slab')],reward:'Yard badge and wrecking ball',unlock:'wrecking'},
];
export const SANDBOX = {...base,id:0,title:'Open site',goal:'Build, reshape the terrain, and test your own structures.',machines:['skid'],toys:[toy(-4,4),toy(-1,4,'beam'),toy(3,3,'barrel',COLORS[2])]};
export const HINTS = ['Try W or the left stick to drive.', 'Try I and K, or the right stick, to lift your tool.', 'Bring the tool close to a block, then press Grab.', 'Release over the blue square. Let the block settle.', 'Drag the yard to look around.', 'Press E to hop into another machine.', 'You can reset the blocks whenever you like.'];
export const VOICE_LINES = [...ROUNDS.flatMap(r=>[r.goal,`Job complete. Unlocked: ${r.reward}.`]),...Object.values(MACHINES).map(m=>m.hint),...HINTS,SANDBOX.goal,'Site saved.','Build Crew is ready.','Loads reset. Ready to build.'];
