// room2.js — "The Library of Symbols"
// Puzzles: Symbol Pattern Matching + Simon Says color sequence
import * as THREE from 'three';

/* ══════════════════════════════════════════════════════
   ROOM 2  —  Stone library, blue-torchlight atmosphere
   Layout: X[-5,5]  Y[0,4]  Z[-5,5]
   Entry door (from room1): Z=+5 (player walks in from south)
   Exit door (to room3):    Z=-5 (north wall)
══════════════════════════════════════════════════════ */

const SYMBOLS = ['✦', '⬟', '⊗', '△', '⬡', '⊕'];
const SIMON_COLORS = [0xff3333, 0x33ff66, 0x3388ff, 0xffdd00]; // R G B Y
const SIMON_EMISSIVE = [0xff0000, 0x00ff44, 0x0055ff, 0xffcc00];
const SIMON_SEQUENCE_LEN = 4;

export class Room2 {
  constructor() {
    this._meshes = [];       // all meshes to destroy on exit
    this._lights = [];       // all lights to destroy
    this._puzzleSymbols  = null;  // { answer, panels[] }
    this._simonState     = null;

    // Solved flags
    this.symbolSolved = false;
    this.simonSolved  = false;
    this.doorOpen     = false;
    this._doorAnim    = false;
    this._doorGroup   = null;
    this._doorCollider= null;

    // Callbacks set by puzzle.js
    this.onBothSolved = null;  // () => void  — open exit door
  }

  /* ── Spawn ── */
  spawnPoint() {
    return { pos: new THREE.Vector3(0, 1.72, 3.5), yaw: Math.PI }; // face north
  }

  /* ══════════════════════════════════
     BUILD
  ══════════════════════════════════ */
  build(scene, gs) {
    this._scene = scene;
    this._gs    = gs;

    this._buildLighting(scene);
    this._buildRoom(scene, gs);
    this._buildFurniture(scene, gs);
    this._buildSymbolPuzzle(scene, gs);
    this._buildSimonPuzzle(scene, gs);
  }

  /* ── Lighting: cool blue stone library ── */
  _buildLighting(scene) {
    const amb = new THREE.AmbientLight(0x8899cc, 1.4);
    scene.add(amb); this._lights.push(amb);

    const ceiling = new THREE.PointLight(0xaabbff, 3.0, 26);
    ceiling.position.set(0, 3.7, 0);
    ceiling.castShadow = true;
    scene.add(ceiling); this._lights.push(ceiling);

    const lampMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12,12,12),
      new THREE.MeshBasicMaterial({ color: 0xbbccff })
    );
    lampMesh.position.copy(ceiling.position);
    scene.add(lampMesh); this._meshes.push(lampMesh);

    // Blue torch sconces
    const torchPositions = [[-4.8,2.5,-2],[4.8,2.5,-2],[-4.8,2.5,2],[4.8,2.5,2]];
    torchPositions.forEach(([x,y,z]) => {
      const t = new THREE.PointLight(0x4488ff, 1.2, 7);
      t.position.set(x,y,z); scene.add(t); this._lights.push(t);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6),
        new THREE.MeshBasicMaterial({color:0x88aaff}));
      g.position.set(x,y,z); scene.add(g); this._meshes.push(g);
    });

    scene.background = new THREE.Color(0x1a2040);
    scene.fog = new THREE.FogExp2(0x1a2040, 0.014);
  }

  /* ── Room shell ── */
  _buildRoom(scene, gs) {
    const W=10, H=4, D=10;
    const doorW=1.5, doorH=3.0;
    const sideW = (W-doorW)/2;

    const stoneMat  = this._std(0x7788aa, 0.92);
    const stoneDk   = this._std(0x556677, 0.95);
    const floorMat  = this._std(0x445566, 0.98);
    const ceilMat   = this._std(0x334455, 0.95);
    const framMat   = this._std(0x2a3a50, 0.70);

    // Floor & ceiling
    this._box(scene, W,0.12,D, [0,-0.06,0], floorMat, false, true);
    this._box(scene, W,0.12,D, [0,H+0.06,0], ceilMat, false, true);

    // Walls (NO full back wall - built with gap below)
    this._box(scene, 0.2,H,D, [-5.1,H/2,0], stoneDk, false, true);
    this._box(scene, 0.2,H,D, [5.1,H/2,0], stoneDk, false, true);

    // Front wall (entry from room1) - solid
    this._box(scene, W,H,0.2, [0,H/2,5.1], stoneMat, false, true);

    // Back (exit) wall WITH door gap - three pieces only
    this._box(scene, sideW,H,0.2, [-5+sideW/2,H/2,-5.1], stoneMat, false, true);
    this._box(scene, sideW,H,0.2, [5-sideW/2,H/2,-5.1], stoneMat, false, true);
    this._box(scene, doorW,H-doorH,0.2, [0,doorH+(H-doorH)/2,-5.1], stoneMat, false, true);

    // Door frame
    this._box(scene, 0.12,doorH+0.12,0.22, [-doorW/2-0.06,doorH/2,-5.1], framMat);
    this._box(scene, 0.12,doorH+0.12,0.22, [doorW/2+0.06,doorH/2,-5.1], framMat);
    this._box(scene, doorW+0.24,0.12,0.22, [0,doorH+0.06,-5.1], framMat);

    // Stone tile pattern on floor
    for(let x=-4;x<=4;x+=2) for(let z=-4;z<=4;z+=2){
      const tile = this._std(x%4===0?0x3a4d66:0x435870, 0.97);
      this._box(scene,1.9,0.01,1.9,[x,0.01,z],tile,false,true);
    }

    // Collidables
    gs.collidables.push(
      {min:new THREE.Vector3(-5.2,0,-5.2), max:new THREE.Vector3(5.2,H,-4.8)},
      {min:new THREE.Vector3(-5.2,0,-5.2), max:new THREE.Vector3(-4.8,H,5.2)},
      {min:new THREE.Vector3(4.8,0,-5.2),  max:new THREE.Vector3(5.2,H,5.2)},
      {min:new THREE.Vector3(-5.2,0,4.8),  max:new THREE.Vector3(5.2,H,5.2)},
    );

    // Door collider (exit, north)
    this._doorCollider = {min:new THREE.Vector3(-0.75,0,-5.2), max:new THREE.Vector3(0.75,doorH,-4.8)};
    gs.collidables.push(this._doorCollider);
    this._gs = gs;

    // Build exit door
    this._buildExitDoor(scene, gs, doorW, doorH);
  }

  _buildExitDoor(scene, gs, doorW, doorH) {
    this._doorGroup = new THREE.Group();
    this._doorGroup.position.set(0,0,-5.05);
    scene.add(this._doorGroup); this._meshes.push(this._doorGroup);

    const mat = this._std(0x223355, 0.65, 0.1);
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW,doorH,0.09), mat);
    door.position.set(0,doorH/2,0);
    door.castShadow = true;
    this._doorGroup.add(door);
    gs.door = door;

    // Iron banding
    const bandMat = new THREE.MeshStandardMaterial({color:0x556677, metalness:0.8, roughness:0.3});
    [-0.8,0,0.8].forEach(y => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(doorW*0.9,0.06,0.12), bandMat);
      band.position.set(0,doorH/2+y,0.05);
      this._doorGroup.add(band);
    });

    // Handle
    const hdlMat = new THREE.MeshStandardMaterial({color:0x8899bb, metalness:0.85, roughness:0.2});
    const hdl = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.06), hdlMat);
    hdl.position.set(doorW/2-0.2, doorH/2, 0.1);
    this._doorGroup.add(hdl);

    door.userData.name = 'door';
    gs.interactables['door'] = door;
    gs.doorGroup = this._doorGroup;
  }

  /* ── Furniture: stone columns, lectern, pedestals ── */
  _buildFurniture(scene, gs) {
    const stone = this._std(0x667788, 0.95);
    const dark  = this._std(0x445566, 0.98);

    // Stone columns (4 corners area)
    [[-3,0,-3],[3,0,-3],[-3,0,1],[3,0,1]].forEach(([x,,z])=>{
      this._box(scene,0.5,4,0.5,[x,2,z],stone,true,true);
      this._box(scene,0.65,0.2,0.65,[x,3.9,z],dark,true,true);
      this._box(scene,0.65,0.2,0.65,[x,0.1,z],dark);
      gs.collidables.push({
        min:new THREE.Vector3(x-0.35,0,z-0.35),
        max:new THREE.Vector3(x+0.35,4,z+0.35)
      });
    });

    // Central lectern / altar table
    this._box(scene,1.4,0.9,0.8,[0,0.45,0],this._std(0x55667a,0.85),true,true);
    this._box(scene,1.6,0.08,1.0,[0,0.94,0],this._std(0x44556a,0.75,0.05),true,true);
    gs.collidables.push({min:new THREE.Vector3(-0.85,0,-0.55), max:new THREE.Vector3(0.85,1.0,0.55)});

    // Bookshelves on left wall
    const shelfMat = this._std(0x334455,0.85);
    this._box(scene,1.8,3.2,0.4,[-4.7,1.6,0],shelfMat,true,true);
    [-0.5,0.5,1.5].forEach(y=>this._box(scene,1.6,0.06,0.36,[-4.7,0.4+y,0],shelfMat));
    // Books — ancient blue/purple tomes
    const bkCols=[0x223366,0x442288,0x116644,0x661122,0x334477,0x552244,0x224455];
    for(let i=0;i<7;i++){
      const bm=new THREE.MeshStandardMaterial({color:bkCols[i],roughness:0.85});
      this._box(scene,0.10,0.30+(i%3)*0.04,0.30,[-5.15+i*0.22,0.62+Math.floor(i/3)*1.0,0],bm,true);
    }
    gs.collidables.push({min:new THREE.Vector3(-5.1,0,-0.4), max:new THREE.Vector3(-4.2,3.5,0.4)});

    // Pedestal for Simon Says on right side
    this._box(scene,0.6,1.0,0.6,[3.5,0.5,0],this._std(0x445566,0.9),true,true);
    this._box(scene,0.75,0.08,0.75,[3.5,1.04,0],this._std(0x3a4d60,0.8),true,true);
    gs.collidables.push({min:new THREE.Vector3(3.1,0,-0.4), max:new THREE.Vector3(3.9,1.1,0.4)});
  }

  /* ══════════════════════════════════
     PUZZLE 1 — SYMBOL MATCHING
     3 symbol panels on back wall.
     A reference panel on lectern shows the pattern.
     Player must press panels in correct order.
  ══════════════════════════════════ */
  _buildSymbolPuzzle(scene, gs) {
    // Random 3-symbol answer from SYMBOLS list
    const answer = [];
    const pool = [...SYMBOLS];
    for(let i=0;i<3;i++){
      const idx = Math.floor(Math.random()*pool.length);
      answer.push(pool.splice(idx,1)[0]);
    }

    // ── Reference card on lectern ──
    const refCv = document.createElement('canvas');
    refCv.width=512; refCv.height=256;
    const ctx = refCv.getContext('2d');

    // Parchment-blue bg
    const grad = ctx.createLinearGradient(0,0,512,256);
    grad.addColorStop(0,'#1a2a4a'); grad.addColorStop(1,'#0d1a33');
    ctx.fillStyle=grad; ctx.fillRect(0,0,512,256);
    ctx.strokeStyle='rgba(100,150,255,0.3)'; ctx.lineWidth=3;
    ctx.strokeRect(8,8,496,240);

    ctx.fillStyle='#88aaff'; ctx.font='bold 18px Georgia,serif'; ctx.textAlign='center';
    ctx.fillText('✦ PRESS THE SYMBOLS IN ORDER ✦',256,36);
    ctx.fillStyle='rgba(100,150,255,0.2)'; ctx.fillRect(60,55,392,140);
    ctx.fillStyle='#ccddff'; ctx.font='bold 72px serif'; ctx.textAlign='center';
    answer.forEach((sym,i)=>{
      ctx.fillText(sym, 130+i*126, 135);
    });
    ctx.fillStyle='#8899bb'; ctx.font='14px Georgia,serif';
    ctx.fillText('— The Order of Symbols —',256,230);

    const refTex = new THREE.CanvasTexture(refCv);
    const refMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3,0.65),
      new THREE.MeshStandardMaterial({map:refTex,roughness:1,side:THREE.DoubleSide})
    );
    refMesh.position.set(0, 1.55, -0.42);
    refMesh.rotation.x = -0.3;
    scene.add(refMesh); this._meshes.push(refMesh);
    refMesh.userData.name = 'symbolRef';
    gs.interactables['symbolRef'] = refMesh;

    // ── 6 symbol panels on back wall (north) ──
    const panels = [];
    const allSyms = [...SYMBOLS]; // all 6
    allSyms.sort(()=>Math.random()-0.5); // shuffle display order

    const panelPositions = [
      [-3.5,2.5,-4.85],[-1.5,2.5,-4.85],[0.5,2.5,-4.85],
      [2.5,2.5,-4.85],[-2.5,1.2,-4.85],[1.5,1.2,-4.85]
    ];

    allSyms.slice(0,6).forEach((sym,i)=>{
      if(!panelPositions[i]) return;
      const panel = this._buildSymbolPanel(scene, sym, panelPositions[i], i, answer, panels, gs);
      panels.push({mesh:panel.mesh, light:panel.light, sym});
    });

    // Status indicator above the door
    const statusCv = document.createElement('canvas');
    statusCv.width=256; statusCv.height=64;
    const sctx = statusCv.getContext('2d');
    sctx.fillStyle='#0d1a33'; sctx.fillRect(0,0,256,64);
    sctx.fillStyle='#ff4444'; sctx.font='bold 20px monospace'; sctx.textAlign='center';
    sctx.fillText('[ _ ]  [ _ ]  [ _ ]',128,40);
    const statusTex = new THREE.CanvasTexture(statusCv);
    const statusMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2,0.3),
      new THREE.MeshStandardMaterial({map:statusTex,emissive:new THREE.Color(0x001133),emissiveIntensity:0.3,side:THREE.DoubleSide})
    );
    statusMesh.position.set(0,3.3,-4.85);
    scene.add(statusMesh); this._meshes.push(statusMesh);

    this._puzzleSymbols = { answer, panels, pressed:[], statusMesh, statusTex, statusCv };
  }

  _buildSymbolPanel(scene, sym, pos, idx, answer, panels, gs) {
    // Frame
    const frameMat = this._std(0x223355,0.8,0.1);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.75,0.75,0.06), frameMat);
    frame.position.set(...pos);
    scene.add(frame); this._meshes.push(frame);

    // Face canvas
    const cv=document.createElement('canvas'); cv.width=128; cv.height=128;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#0a1a33'; ctx.fillRect(0,0,128,128);
    ctx.fillStyle='#5588cc'; ctx.font='bold 72px serif'; ctx.textAlign='center';
    ctx.fillText(sym,64,90);
    const tex=new THREE.CanvasTexture(cv);

    const mat=new THREE.MeshStandardMaterial({
      map:tex, emissive:new THREE.Color(0x112244), emissiveIntensity:0.2
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.65,0.65), mat);
    mesh.position.set(pos[0],pos[1],pos[2]+0.04);
    scene.add(mesh); this._meshes.push(mesh);

    // Glow light
    const light=new THREE.PointLight(0x3366ff,0,1.2);
    light.position.set(pos[0],pos[1],pos[2]+0.3);
    scene.add(light); this._lights.push(light);

    const panelName = `symPanel_${idx}`;
    mesh.userData.name = panelName;
    frame.userData.name = panelName;
    gs.interactables[panelName] = mesh;
    // Store sym on mesh
    mesh.userData.sym = sym;
    mesh.userData.panelIdx = idx;

    return {mesh, light};
  }

  // Called by puzzle system when player clicks a symbol panel
  pressSymbol(sym, mesh, gs, snd) {
    if(this.symbolSolved) return;
    const st = this._puzzleSymbols;
    st.pressed.push(sym);

    // Flash the panel blue
    const mat = mesh.material;
    const origIntensity = mat.emissiveIntensity;
    mat.emissive.set(0x0088ff);
    mat.emissiveIntensity = 1.0;
    setTimeout(()=>{ mat.emissive.set(0x112244); mat.emissiveIntensity=origIntensity; },300);

    // Check so far
    const n = st.pressed.length;
    const correct = st.pressed.every((s,i)=>s===st.answer[i]);

    if(!correct){
      snd?.playSymbolWrong();
      setTimeout(()=>{
        st.pressed = [];
        this._updateSymbolStatus([], []);
        this._flashAllPanels(0xff2222);
      },400);
      return;
    }

    this._updateSymbolStatus(st.pressed, st.answer);

    if(n === st.answer.length){
      this.symbolSolved = true;
      snd?.playSuccess();
      this._flashAllPanels(0x00ff88);
      st.panels.forEach(p=>{ p.light.color.set(0x00ff88); p.light.intensity=0.8; });
      this._checkBothSolved(gs);
    }
  }

  _updateSymbolStatus(pressed, answer) {
    const st = this._puzzleSymbols;
    const cv = st.statusCv;
    const ctx = cv.getContext('2d');
    ctx.fillStyle='#0d1a33'; ctx.fillRect(0,0,256,64);

    const display = [0,1,2].map(i=> i<pressed.length ? pressed[i] : '_');
    display.forEach((sym,i)=>{
      const ok = i<pressed.length && pressed[i]===answer[i];
      ctx.fillStyle = i<pressed.length ? (ok?'#44ff88':'#ff4444') : '#4466aa';
      ctx.font='bold 26px serif'; ctx.textAlign='center';
      ctx.fillText(sym, 45+i*83, 42);
    });
    // brackets
    ctx.strokeStyle='#3355aa'; ctx.lineWidth=2;
    [0,1,2].forEach(i=>{ctx.strokeRect(12+i*83,12,58,44);});
    st.statusTex.needsUpdate = true;
  }

  _flashAllPanels(hexColor) {
    this._puzzleSymbols.panels.forEach(p=>{
      const mat = p.mesh.material;
      mat.emissive.set(hexColor);
      mat.emissiveIntensity=1.0;
      setTimeout(()=>{
        mat.emissive.set(hexColor===0x00ff88?0x003322:0x112244);
        mat.emissiveIntensity = hexColor===0x00ff88?0.4:0.2;
      },500);
    });
  }

  /* ══════════════════════════════════
     PUZZLE 2 — SIMON SAYS COLOR SEQUENCE
     4 colored pads on pedestal.
     Watch the sequence, repeat it!
     Sequence length = 4.
  ══════════════════════════════════ */
  _buildSimonPuzzle(scene, gs) {
    // Generate random sequence
    const sequence = Array.from({length:SIMON_SEQUENCE_LEN},
      ()=>Math.floor(Math.random()*4));

    const padNames  = ['simonR','simonG','simonB','simonY'];
    const padLayout = [[-0.22,1.22,0.22],[0.22,1.22,0.22],[-0.22,1.22,-0.22],[0.22,1.22,-0.22]];
    const pads = [];

    padLayout.forEach((offset,i)=>{
      const mat = new THREE.MeshStandardMaterial({
        color:SIMON_COLORS[i], emissive:new THREE.Color(SIMON_COLORS[i]),
        emissiveIntensity:0.1, roughness:0.4, metalness:0.1
      });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.38,0.04,0.38), mat);
      pad.position.set(3.5+offset[0], offset[1], offset[2]);
      pad.castShadow=true;
      scene.add(pad); this._meshes.push(pad);
      pad.userData.name = padNames[i];
      pad.userData.simonIdx = i;
      gs.interactables[padNames[i]] = pad;
      pads.push({mesh:pad, mat});
    });

    // Label card on pedestal side
    const lCv=document.createElement('canvas'); lCv.width=256; lCv.height=128;
    const lCtx=lCv.getContext('2d');
    lCtx.fillStyle='#1a2a4a'; lCtx.fillRect(0,0,256,128);
    lCtx.fillStyle='#88aaff'; lCtx.font='bold 15px monospace'; lCtx.textAlign='center';
    lCtx.fillText('SIMON SAYS',128,30);
    lCtx.fillStyle='#5577aa'; lCtx.font='12px monospace';
    lCtx.fillText('Watch the pattern,',128,60);
    lCtx.fillText('then repeat it!',128,80);
    lCtx.fillStyle='#ffdd44'; lCtx.font='bold 13px monospace';
    lCtx.fillText('[E] to start / interact',128,110);
    const lTex=new THREE.CanvasTexture(lCv);
    const lMesh=new THREE.Mesh(new THREE.PlaneGeometry(0.68,0.34),
      new THREE.MeshStandardMaterial({map:lTex,roughness:1,side:THREE.DoubleSide}));
    lMesh.position.set(3.5,0.78,0.31);
    lMesh.rotation.y=Math.PI;
    scene.add(lMesh); this._meshes.push(lMesh);

    // Speaker box (decorative) on top of pedestal
    const spkMat=this._std(0x223344,0.8,0.2);
    this._box(scene,0.55,0.12,0.55,[3.5,1.06,0],spkMat,true);

    // Status display above Simon area
    const sCv=document.createElement('canvas'); sCv.width=256; sCv.height=64;
    const sCtx=sCv.getContext('2d');
    sCtx.fillStyle='#0a1525'; sCtx.fillRect(0,0,256,64);
    sCtx.fillStyle='#4488ff'; sCtx.font='bold 16px monospace'; sCtx.textAlign='center';
    sCtx.fillText('PRESS [E] TO START',128,38);
    const sTex=new THREE.CanvasTexture(sCv);
    const sDisp=new THREE.Mesh(new THREE.PlaneGeometry(0.75,0.2),
      new THREE.MeshStandardMaterial({map:sTex,emissive:new THREE.Color(0x001133),emissiveIntensity:0.4,side:THREE.DoubleSide}));
    sDisp.position.set(3.5,1.45,0.31);
    sDisp.rotation.y=Math.PI;
    scene.add(sDisp); this._meshes.push(sDisp);

    // "Start" trigger — clicking the speaker starts Simon
    const startTrigger=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.12,0.55), new THREE.MeshStandardMaterial({transparent:true,opacity:0}));
    startTrigger.position.set(3.5,1.06,0);
    scene.add(startTrigger); this._meshes.push(startTrigger);
    startTrigger.userData.name='simonStart';
    gs.interactables['simonStart']=startTrigger;

    this._simonState = {
      sequence, pads, padNames,
      playerInput:[],
      phase:'idle',  // idle | showing | input
      showStep:0,
      displayMesh:sDisp, displayTex:sTex, displayCv:sCv,
    };
  }

  startSimon(gs, snd) {
    const st = this._simonState;
    if(st.phase!=='idle') return;
    this._updateSimonDisplay('WATCH...','#ffdd44');
    st.phase='showing';
    st.showStep=0;
    st.playerInput=[];
    this._showNextSimonStep(gs, snd);
  }

  _showNextSimonStep(gs, snd) {
    const st = this._simonState;
    if(st.showStep >= st.sequence.length){
      setTimeout(()=>{
        st.phase='input';
        st.playerInput=[];
        this._updateSimonDisplay(`YOUR TURN (0/${st.sequence.length})`, '#44ffaa');
      }, 600);
      return;
    }
    const padIdx = st.sequence[st.showStep];
    const pad = st.pads[padIdx];
    setTimeout(()=>{
      snd?.playSimonPad(padIdx);
      pad.mat.emissiveIntensity=1.0;
      setTimeout(()=>{
        pad.mat.emissiveIntensity=0.1;
        st.showStep++;
        this._showNextSimonStep(gs, snd);
      }, 550);
    }, 200);
  }

  pressSimon(padIdx, gs, snd) {
    const st = this._simonState;
    if(st.phase!=='input' || this.simonSolved) return;

    const pad = st.pads[padIdx];
    pad.mat.emissiveIntensity=0.9;
    setTimeout(()=>pad.mat.emissiveIntensity=0.1, 300);

    st.playerInput.push(padIdx);
    const n = st.playerInput.length;

    if(st.playerInput[n-1] !== st.sequence[n-1]){
      snd?.playSimonWrong();
      this._updateSimonDisplay('WRONG! RESTARTING...','#ff4444');
      st.phase='idle';
      setTimeout(()=>{
        this._updateSimonDisplay('PRESS [E] TO RETRY','#4488ff');
      }, 1500);
      return;
    }

    this._updateSimonDisplay(`YOUR TURN (${n}/${st.sequence.length})`, '#44ffaa');

    if(n === st.sequence.length){
      this.simonSolved=true;
      st.phase='solved';
      snd?.playSimonComplete();
      this._updateSimonDisplay('SEQUENCE CORRECT!','#00ff88');
      st.pads.forEach(p=>{p.mat.emissiveIntensity=1.0; p.mat.emissive.set(0x00ff88);});
      this._checkBothSolved(gs);
    }
  }

  _updateSimonDisplay(text, color) {
    const st = this._simonState;
    const ctx = st.displayCv.getContext('2d');
    ctx.fillStyle='#0a1525'; ctx.fillRect(0,0,256,64);
    ctx.fillStyle=color||'#4488ff'; ctx.font='bold 13px monospace'; ctx.textAlign='center';
    ctx.fillText(text,128,38);
    st.displayTex.needsUpdate=true;
  }

  /* ── Both puzzles solved → open exit door ── */
  _checkBothSolved(gs) {
    if(this.symbolSolved && this.simonSolved){
      setTimeout(()=>{
        if(this.onBothSolved) this.onBothSolved();
        this._openExitDoor(gs);
      }, 800);
    }
  }

  _openExitDoor(gs) {
    if(this.doorOpen || this._doorAnim) return;
    this._doorAnim=true;
    const idx = gs.collidables.indexOf(this._doorCollider);
    if(idx!==-1) gs.collidables.splice(idx,1);
    const startY = this._doorGroup.position.y;
    const targetY=4.5, dur=1400, t0=performance.now();
    const animate=now=>{
      const t=Math.min((now-t0)/dur,1);
      const e=t<0.5?2*t*t:-1+(4-2*t)*t;
      this._doorGroup.position.y=startY+(targetY-startY)*e;
      if(t<1) requestAnimationFrame(animate);
      else{ this.doorOpen=true; this._doorAnim=false; gs.doorOpen=true; }
    };
    requestAnimationFrame(animate);
  }

  /* ══════════════════════════════════
     DESTROY (cleanup on room exit)
  ══════════════════════════════════ */
  destroy(scene) {
    this._meshes.forEach(m=>scene.remove(m));
    this._lights.forEach(l=>scene.remove(l));
    this._meshes=[];
    this._lights=[];
  }

  /* ── Helpers ── */
  _std(color, roughness=0.8, metalness=0.0){
    return new THREE.MeshStandardMaterial({color, roughness, metalness});
  }
  _box(scene,w,h,d,pos,mat,castShadow=false,receiveShadow=false){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(...pos);
    m.castShadow=castShadow; m.receiveShadow=receiveShadow;
    scene.add(m); this._meshes.push(m);
    return m;
  }
}
