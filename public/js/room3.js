// room3.js — "The Vault"
// Puzzle: Hidden Object Hunt — find 3 key fragments hidden around the room
import * as THREE from 'three';

/* ══════════════════════════════════════════════════════
   ROOM 3  —  Ancient vault, red/gold torchlight
   Layout: X[-5,5]  Y[0,4]  Z[-5,5]
   Entry door: Z=+5 (south)
   Exit: Z=-5 (north) — final escape!
══════════════════════════════════════════════════════ */

const FRAGMENT_POSITIONS = [
  // [x, y, z, description, hint]
  [  2.2, 0.72, -3.8,  'Behind the altar candles', 'Check near the altar...' ],
  [ -3.5, 1.65,  1.2,  'Wedged in the bookshelf',  'Something glints on the shelf...' ],
  [  3.8, 0.35,  2.5,  'Under the sarcophagus lid', 'Look near the stone coffin...' ],
];

export class Room3 {
  constructor() {
    this._meshes  = [];
    this._lights  = [];
    this._fragments = [];   // { mesh, found, glowLight, pos }
    this._fragmentsFound = 0;

    this.doorOpen  = false;
    this._doorAnim = false;
    this._doorGroup= null;
    this._doorCollider=null;

    // Animated elements
    this._torches = [];   // { light, phase }
    this._particles= [];  // floating dust

    this.onAllFragmentsFound = null;  // () => void
  }

  spawnPoint() {
    return { pos: new THREE.Vector3(0,1.72,3.5), yaw: Math.PI };
  }

  /* ══════════════════════════════════
     BUILD
  ══════════════════════════════════ */
  build(scene, gs) {
    this._scene=scene;
    this._gs=gs;

    scene.background=new THREE.Color(0x1a0c05);
    scene.fog=new THREE.FogExp2(0x1a0c05, 0.016);

    this._buildLighting(scene);
    this._buildRoom(scene, gs);
    this._buildFurniture(scene, gs);
    this._buildFragments(scene, gs);
    this._buildProgressDisplay(scene);
  }

  /* ── Deep red/gold vault lighting ── */
  _buildLighting(scene) {
    const amb=new THREE.AmbientLight(0x441a08, 1.0);
    scene.add(amb); this._lights.push(amb);

    // Main ceiling chain lamp
    const ceil=new THREE.PointLight(0xff8833, 2.5, 22);
    ceil.position.set(0,3.7,0);
    ceil.castShadow=true;
    scene.add(ceil); this._lights.push(ceil);

    const lampM=new THREE.Mesh(new THREE.SphereGeometry(0.14,12,12),
      new THREE.MeshBasicMaterial({color:0xffaa44}));
    lampM.position.copy(ceil.position);
    scene.add(lampM); this._meshes.push(lampM);

    // Flickering wall torches (4 of them)
    const torchPos=[[-4.6,2.2,-2],[4.6,2.2,-2],[-4.6,2.2,2],[4.6,2.2,2]];
    torchPos.forEach(([x,y,z])=>{
      const tl=new THREE.PointLight(0xff6600, 1.8, 6);
      tl.position.set(x,y,z);
      scene.add(tl); this._lights.push(tl);
      this._torches.push({light:tl, base:1.8, phase:Math.random()*Math.PI*2});

      // Torch mesh
      const stick=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.4,6),
        new THREE.MeshLambertMaterial({color:0x553311}));
      stick.position.set(x,y-0.1,z);
      scene.add(stick); this._meshes.push(stick);
      const flame=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.18,6),
        new THREE.MeshBasicMaterial({color:0xff8822}));
      flame.position.set(x,y+0.15,z);
      scene.add(flame); this._meshes.push(flame);

      // Wall bracket
      const bkt=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.2),
        new THREE.MeshStandardMaterial({color:0x444444,metalness:0.8}));
      bkt.position.set(x>0?x-0.14:x+0.14, y, z);
      scene.add(bkt); this._meshes.push(bkt);
    });

    // Red dramatic backlight
    const back=new THREE.DirectionalLight(0x660011, 0.4);
    back.position.set(0,3,-6); scene.add(back); this._lights.push(back);
  }

  /* ── Vault room shell ── */
  _buildRoom(scene, gs) {
    const W=10, H=4, D=10;
    const doorW=1.5, doorH=3.0;
    const sideW=(W-doorW)/2;

    const stoneMat = this._std(0x3a2010, 0.97);
    const stoneDk  = this._std(0x2a1808, 0.99);
    const floorMat = this._std(0x2c1a0e, 0.99);
    const ceilMat  = this._std(0x221208, 0.99);
    const framMat  = this._std(0x4a2810, 0.75, 0.1);
    const goldMat  = new THREE.MeshStandardMaterial({color:0xc8900a,metalness:0.85,roughness:0.2});

    // Floor
    this._box(scene,W,0.12,D,[0,-0.06,0],floorMat,false,true);
    // Ceiling
    this._box(scene,W,0.12,D,[0,H+0.06,0],ceilMat,false,true);

    // Walls
    this._box(scene,W,H,0.2,[0,H/2,-5.1],stoneMat,false,true); // back
    this._box(scene,0.2,H,D,[-5.1,H/2,0],stoneDk,false,true);
    this._box(scene,0.2,H,D,[5.1,H/2,0],stoneDk,false,true);
    this._box(scene,W,H,0.2,[0,H/2,5.1],stoneMat,false,true); // front (entry, solid)

    // Back wall with door gap
    this._box(scene,sideW,H,0.2,[-5+sideW/2,H/2,-5.1],stoneMat,false,true);
    this._box(scene,sideW,H,0.2,[5-sideW/2,H/2,-5.1],stoneMat,false,true);
    this._box(scene,doorW,H-doorH,0.2,[0,doorH+(H-doorH)/2,-5.1],stoneMat,false,true);

    // Gold-trimmed door frame
    this._box(scene,0.14,doorH+0.14,0.24,[-doorW/2-0.07,doorH/2,-5.1],framMat);
    this._box(scene,0.14,doorH+0.14,0.24,[doorW/2+0.07,doorH/2,-5.1],framMat);
    this._box(scene,doorW+0.28,0.14,0.24,[0,doorH+0.07,-5.1],framMat);
    // Gold accents on frame
    [[-doorW/2-0.07,doorH,-5.05],[doorW/2+0.07,doorH,-5.05]].forEach(([x,y,z])=>{
      const gem=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8),goldMat);
      gem.position.set(x,y,z); scene.add(gem); this._meshes.push(gem);
    });

    // Stone floor tiles with gold inlay lines
    for(let x=-4;x<=4;x+=2) for(let z=-4;z<=4;z+=2){
      const tileMat=this._std(x===z?0x3d2215:0x2e1a0c,0.98);
      this._box(scene,1.85,0.01,1.85,[x,0.01,z],tileMat,false,true);
    }
    // Gold border strips
    for(let x=-4;x<=4;x+=2){
      const gBorder=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.012,10),goldMat);
      gBorder.position.set(x-0.93,0.015,0);
      scene.add(gBorder); this._meshes.push(gBorder);
    }

    // Collidables
    gs.collidables.push(
      {min:new THREE.Vector3(-5.2,0,-5.2), max:new THREE.Vector3(5.2,H,-4.8)},
      {min:new THREE.Vector3(-5.2,0,-5.2), max:new THREE.Vector3(-4.8,H,5.2)},
      {min:new THREE.Vector3(4.8,0,-5.2),  max:new THREE.Vector3(5.2,H,5.2)},
      {min:new THREE.Vector3(-5.2,0,4.8),  max:new THREE.Vector3(5.2,H,5.2)},
    );
    this._doorCollider={min:new THREE.Vector3(-0.75,0,-5.2), max:new THREE.Vector3(0.75,doorH,-4.8)};
    gs.collidables.push(this._doorCollider);

    this._buildExitDoor(scene, gs, doorW, doorH);
  }

  _buildExitDoor(scene,gs,doorW,doorH){
    this._doorGroup=new THREE.Group();
    this._doorGroup.position.set(0,0,-5.05);
    scene.add(this._doorGroup); this._meshes.push(this._doorGroup);

    const mat=new THREE.MeshStandardMaterial({color:0x7a4010,roughness:0.6,metalness:0.15});
    const door=new THREE.Mesh(new THREE.BoxGeometry(doorW,doorH,0.1),mat);
    door.position.set(0,doorH/2,0);
    door.castShadow=true;
    this._doorGroup.add(door);

    // Gold studded bands
    const gMat=new THREE.MeshStandardMaterial({color:0xc8900a,metalness:0.9,roughness:0.15});
    [-0.9,0,0.9].forEach(y=>{
      const band=new THREE.Mesh(new THREE.BoxGeometry(doorW*0.88,0.07,0.13),gMat);
      band.position.set(0,doorH/2+y,0.06);
      this._doorGroup.add(band);
    });
    // Gold studs
    for(let sx=-0.5;sx<=0.5;sx+=0.25){
      [-0.9,0,0.9].forEach(sy=>{
        const stud=new THREE.Mesh(new THREE.SphereGeometry(0.035,6,6),gMat);
        stud.position.set(sx,doorH/2+sy,0.1);
        this._doorGroup.add(stud);
      });
    }
    // Large ring handle
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.1,0.025,8,16),gMat);
    ring.position.set(doorW/2-0.25,doorH/2,0.13);
    ring.rotation.y=Math.PI/2;
    this._doorGroup.add(ring);

    // Glow emanating from door edges when locked
    const lockGlow=new THREE.PointLight(0xff2200,0.8,2);
    lockGlow.position.set(0,doorH/2,-4.8);
    scene.add(lockGlow); this._lights.push(lockGlow);
    this._lockGlow=lockGlow;

    door.userData.name='door';
    gs.interactables['door']=door;
    gs.doorGroup=this._doorGroup;
    gs.door=door;
  }

  /* ── Furniture: altar, sarcophagus, pillars, shelves ── */
  _buildFurniture(scene,gs){
    const stone=this._std(0x4a2c18,0.95);
    const stoneDk=this._std(0x331a0a,0.98);
    const gold=new THREE.MeshStandardMaterial({color:0xb8780a,metalness:0.85,roughness:0.2});
    const wood=this._std(0x5c3011,0.80);

    // ── ALTAR (back centre) ──
    this._box(scene,2.2,0.9,1.0,[0,0.45,-3.8],stone,true,true);
    this._box(scene,2.4,0.12,1.2,[0,0.96,-3.8],this._std(0x5a3418,0.80,0.05),true,true);
    gs.collidables.push({min:new THREE.Vector3(-1.3,0,-4.5),max:new THREE.Vector3(1.3,1.1,-3.2)});

    // Candles on altar
    const candleMat=this._std(0xeecc88,0.9);
    const wickMat=new THREE.MeshBasicMaterial({color:0xffdd66});
    [[-0.7,1.0,-3.8],[-0.35,1.0,-3.75],[0.35,1.0,-3.75],[0.7,1.0,-3.8]].forEach(([x,y,z])=>{
      const candle=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.22,8),candleMat);
      candle.position.set(x,y,z);
      scene.add(candle); this._meshes.push(candle);
      const flame=new THREE.Mesh(new THREE.ConeGeometry(0.02,0.06,6),wickMat);
      flame.position.set(x,y+0.15,z);
      scene.add(flame); this._meshes.push(flame);
    });
    const altarLight=new THREE.PointLight(0xff9922,0.9,3.5);
    altarLight.position.set(0,1.5,-3.8);
    scene.add(altarLight); this._lights.push(altarLight);

    // ── SARCOPHAGUS (right side) ──
    this._box(scene,0.9,0.5,2.2,[3.5,0.25,2.5],stone,true,true);  // base
    this._box(scene,0.95,0.14,2.25,[3.5,0.53,2.5],stoneDk,true,true); // lid
    // Face carvings (decorative rectangles)
    this._box(scene,0.7,0.06,1.8,[3.5,0.57,2.5],this._std(0x5a3020,0.9));
    // Gold trim on lid
    const lidGold=new THREE.Mesh(new THREE.BoxGeometry(0.97,0.03,2.27),gold);
    lidGold.position.set(3.5,0.61,2.5);
    scene.add(lidGold); this._meshes.push(lidGold);
    gs.collidables.push({min:new THREE.Vector3(3.0,0,1.3),max:new THREE.Vector3(4.0,0.65,3.7)});

    // ── BOOKSHELF (left wall) ──
    const shelfM=this._std(0x4a2810,0.88);
    this._box(scene,1.6,3.0,0.42,[-4.7,1.5,1.2],shelfM,true,true);
    [-0.4,0.6,1.6].forEach(y=>this._box(scene,1.4,0.06,0.38,[-4.7,0.4+y,1.2],shelfM));
    const bkCols=[0x3a1a08,0x1a0a38,0x1a3808,0x381a08,0x2a0818,0x083828];
    for(let i=0;i<6;i++){
      const bm=new THREE.MeshStandardMaterial({color:bkCols[i],roughness:0.85});
      this._box(scene,0.10,0.30+(i%3)*0.05,0.35,[-5.15+i*0.24,0.55+Math.floor(i/3)*1.0,1.2],bm,true);
    }
    gs.collidables.push({min:new THREE.Vector3(-5.1,0,0.7),max:new THREE.Vector3(-4.2,3.0,1.7)});

    // ── STONE PILLARS ──
    [[-2.5,0,-2],[2.5,0,-2],[-2.5,0,2],[2.5,0,2]].forEach(([x,,z])=>{
      this._box(scene,0.55,4,0.55,[x,2,z],stone,true,true);
      this._box(scene,0.7,0.18,0.7,[x,3.92,z],stoneDk);
      this._box(scene,0.7,0.18,0.7,[x,0.09,z],stoneDk);
      // Gold band around pillar
      const gb=new THREE.Mesh(new THREE.CylinderGeometry(0.33,0.33,0.1,8),gold);
      gb.position.set(x,1.5,z); scene.add(gb); this._meshes.push(gb);
      gs.collidables.push({min:new THREE.Vector3(x-0.35,0,z-0.35),max:new THREE.Vector3(x+0.35,4,z+0.35)});
    });

    // ── TREASURE CHEST (decorative, left-back) ──
    this._box(scene,0.8,0.5,0.5,[-3.5,0.25,-3.5],wood,true,true);
    this._box(scene,0.82,0.06,0.52,[-3.5,0.53,-3.5],this._std(0x4a2808,0.8),true);
    // Gold bands
    [-0.25,0.25].forEach(dx=>{
      const b=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.56,0.52),gold);
      b.position.set(-3.5+dx,0.25,-3.5); scene.add(b); this._meshes.push(b);
    });
    const lock=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.06),gold);
    lock.position.set(-3.5,0.38,-3.22); scene.add(lock); this._meshes.push(lock);
    gs.collidables.push({min:new THREE.Vector3(-4.0,0,-3.8),max:new THREE.Vector3(-3.0,0.6,-3.2)});

    // ── SKULL DECORATION on shelf ──
    const skulMat=this._std(0xddccaa,0.9);
    const skull=new THREE.Mesh(new THREE.SphereGeometry(0.12,10,10),skulMat);
    skull.position.set(-4.7,3.1,1.2); scene.add(skull); this._meshes.push(skull);
    const jaw=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.06,0.12),skulMat);
    jaw.position.set(-4.7,2.93,1.2); scene.add(jaw); this._meshes.push(jaw);
  }

  /* ══════════════════════════════════
     PUZZLE — HIDDEN OBJECT HUNT
     3 key fragments glowing faintly around room.
     Player must find & collect all 3.
  ══════════════════════════════════ */
  _buildFragments(scene,gs){
    this._fragments=[];
    FRAGMENT_POSITIONS.forEach(([x,y,z,desc,hint],i)=>{
      // Fragment mesh — golden key piece
      const fragMat=new THREE.MeshStandardMaterial({
        color:0xd4a800, metalness:0.92, roughness:0.08,
        emissive:new THREE.Color(0x886600), emissiveIntensity:0.5
      });

      // Interesting shape: rotated box + small cylinder
      const frag=new THREE.Group();
      const body=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.18,0.04),fragMat);
      body.rotation.z=Math.PI/6*(i+1);
      frag.add(body);
      const tooth=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.06,0.04),fragMat);
      tooth.position.set(0.04,0.06,0);
      tooth.rotation.z=Math.PI/6*(i+1);
      frag.add(tooth);
      const hole=new THREE.Mesh(new THREE.TorusGeometry(0.025,0.01,6,12),fragMat);
      hole.position.set(-0.01,0.07,0);
      frag.add(hole);

      frag.position.set(x,y,z);
      scene.add(frag); this._meshes.push(frag);

      // Pulsing glow light
      const glow=new THREE.PointLight(0xffcc00,0.6,1.5);
      glow.position.set(x,y+0.1,z);
      scene.add(glow); this._lights.push(glow);

      // Invisible collider for raycasting
      const trigger=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,0.35),
        new THREE.MeshBasicMaterial({transparent:true,opacity:0.0}));
      trigger.position.set(x,y,z);
      scene.add(trigger); this._meshes.push(trigger);

      const fragName=`fragment_${i}`;
      trigger.userData.name=fragName;
      trigger.userData.hint=hint;
      trigger.userData.fragIdx=i;
      gs.interactables[fragName]=trigger;

      this._fragments.push({group:frag, trigger, glow, found:false, hint, name:fragName});
    });
  }

  /* ── Progress display above exit door ── */
  _buildProgressDisplay(scene){
    const cv=document.createElement('canvas'); cv.width=384; cv.height=96;
    this._progCv=cv;
    this._updateProgressCanvas(0);
    const tex=new THREE.CanvasTexture(cv);
    this._progTex=tex;
    const mesh=new THREE.Mesh(
      new THREE.PlaneGeometry(1.4,0.35),
      new THREE.MeshStandardMaterial({map:tex,emissive:new THREE.Color(0x220800),emissiveIntensity:0.5,side:THREE.DoubleSide})
    );
    mesh.position.set(0,3.3,-4.85);
    scene.add(mesh); this._meshes.push(mesh);
  }

  _updateProgressCanvas(found){
    const cv=this._progCv;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#1a0800'; ctx.fillRect(0,0,384,96);
    ctx.fillStyle='#cc8800'; ctx.font='bold 16px monospace'; ctx.textAlign='center';
    ctx.fillText('KEY FRAGMENTS',192,26);
    const total=FRAGMENT_POSITIONS.length;
    for(let i=0;i<total;i++){
      const x=80+i*112;
      ctx.fillStyle= i<found ? '#ffd700':'#3a2808';
      ctx.beginPath(); ctx.arc(x,62,22,0,Math.PI*2); ctx.fill();
      ctx.fillStyle= i<found ? '#1a0800':'#553300';
      ctx.font='bold 22px serif'; ctx.textAlign='center';
      ctx.fillText(i<found?'🗝':'?',x,70);
    }
    ctx.fillStyle='#886622'; ctx.font='13px monospace'; ctx.textAlign='center';
    ctx.fillText(`${found} / ${total} found`,192,90);
    if(this._progTex) this._progTex.needsUpdate=true;
  }

  /* ── Collect fragment ── */
  collectFragment(fragIdx, gs){
    const frag=this._fragments[fragIdx];
    if(!frag || frag.found) return;
    frag.found=true;
    this._fragmentsFound++;

    // Remove from scene visually (animate out)
    const g=frag.group;
    const startY=g.position.y;
    const t0=performance.now();
    const rise=now=>{
      const t=Math.min((now-t0)/600,1);
      g.position.y=startY+t*0.8;
      g.rotation.y=t*Math.PI*3;
      g.children.forEach(c=>{if(c.material) c.material.opacity=1-t;});
      g.children.forEach(c=>{if(c.material) c.material.transparent=true;});
      frag.glow.intensity=(1-t)*0.6;
      if(t<1) requestAnimationFrame(rise);
      else{
        this._scene.remove(g);
        this._scene.remove(frag.glow);
        delete gs.interactables[frag.name];
      }
    };
    requestAnimationFrame(rise);

    this._updateProgressCanvas(this._fragmentsFound);

    if(this._fragmentsFound>=FRAGMENT_POSITIONS.length){
      setTimeout(()=>{
        if(this.onAllFragmentsFound) this.onAllFragmentsFound();
        this._openExitDoor(gs);
        if(this._lockGlow){ this._lockGlow.color.set(0x00ff88); this._lockGlow.intensity=1.2; }
      }, 600);
    }
  }

  _openExitDoor(gs){
    if(this.doorOpen||this._doorAnim) return;
    this._doorAnim=true;
    const idx=gs.collidables.indexOf(this._doorCollider);
    if(idx!==-1) gs.collidables.splice(idx,1);
    const startY=this._doorGroup.position.y;
    const targetY=4.5, dur=1800, t0=performance.now();
    const animate=now=>{
      const t=Math.min((now-t0)/dur,1);
      const e=t<0.5?2*t*t:-1+(4-2*t)*t;
      this._doorGroup.position.y=startY+(targetY-startY)*e;
      if(t<1) requestAnimationFrame(animate);
      else{ this.doorOpen=true; this._doorAnim=false; gs.doorOpen=true; }
    };
    requestAnimationFrame(animate);
  }

  /* ── Per-frame update: flicker torches, pulse fragments ── */
  update(dt){
    const t=performance.now()/1000;
    // Torch flicker
    this._torches.forEach(torch=>{
      torch.light.intensity=torch.base+(Math.sin(t*7+torch.phase)*0.25+Math.sin(t*13+torch.phase)*0.1);
    });
    // Fragment pulse
    this._fragments.forEach((frag,i)=>{
      if(frag.found) return;
      frag.glow.intensity=0.4+Math.sin(t*2.5+i*1.2)*0.25;
      frag.group.rotation.y=t*0.8+i*Math.PI*0.66;
      frag.group.position.y=FRAGMENT_POSITIONS[i][1]+Math.sin(t*1.5+i*1.0)*0.04;
    });
  }

  /* ══════════════════════════════════
     DESTROY
  ══════════════════════════════════ */
  destroy(scene){
    this._meshes.forEach(m=>scene.remove(m));
    this._lights.forEach(l=>scene.remove(l));
    this._meshes=[]; this._lights=[];
    this._torches=[]; this._fragments=[];
  }

  /* ── Helpers ── */
  _std(color,roughness=0.8,metalness=0.0){
    return new THREE.MeshStandardMaterial({color,roughness,metalness});
  }
  _box(scene,w,h,d,pos,mat,castShadow=false,receiveShadow=false){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(...pos);
    m.castShadow=castShadow; m.receiveShadow=receiveShadow;
    scene.add(m); this._meshes.push(m);
    return m;
  }
}
