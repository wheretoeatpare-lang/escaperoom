// scene.js — Three.js room: walls, lighting, furniture, puzzle objects
import * as THREE from 'three';

export class GameScene {
  constructor() {
    this.scene      = new THREE.Scene();
    this.renderer   = null;
    this.interactables = {};   // name → THREE.Mesh  (raycaster targets)
    this.collidables   = [];   // Array of {min, max} THREE.Vector3 AABB boxes
    this.doorGroup  = null;    // sliding door group
    this.door       = null;    // door mesh (inside doorGroup)
    this.doorOpen   = false;
    this._doorAnim  = false;
    this.lockScreen = null;    // glowing lock display mesh
  }

  /* ═══════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════ */
  init() {
    const canvas = document.getElementById('gameCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;

    this.scene.background = new THREE.Color(0xd4956a);
    this.scene.fog = new THREE.FogExp2(0xc8845a, 0.012);

    this._buildLighting();
    this._buildRoom();
    this._buildFurniture();
    this._buildPuzzleObjects();

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ═══════════════════════════════════════════
     LIGHTING
  ═══════════════════════════════════════════ */
  _buildLighting() {
    // Ambient fill — warm, bright torchlit feel
    this.scene.add(new THREE.AmbientLight(0xffd8a0, 2.2));

    // Ceiling pendant — warm
    const ceiling = new THREE.PointLight(0xffcc77, 4.5, 30);
    ceiling.position.set(0, 3.7, 0);
    ceiling.castShadow = true;
    ceiling.shadow.mapSize.set(1024, 1024);
    ceiling.shadow.bias = -0.002;
    ceiling.shadow.camera.near = 0.1;
    ceiling.shadow.camera.far  = 20;
    this.scene.add(ceiling);

    // Lamp mesh
    const lampMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffee99 })
    );
    lampMesh.position.copy(ceiling.position);
    this.scene.add(lampMesh);

    // Cord
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6),
      new THREE.MeshLambertMaterial({ color: 0x553322 })
    );
    cord.position.set(0, 3.84, 0);
    this.scene.add(cord);

    // Warm torch fill from left wall
    const accent = new THREE.DirectionalLight(0xff9944, 0.6);
    accent.position.set(-6, 3, 0);
    this.scene.add(accent);

    // Second warm fill from back-right
    const fill2 = new THREE.DirectionalLight(0xffc87a, 0.5);
    fill2.position.set(4, 2, -4);
    this.scene.add(fill2);
  }

  /* ═══════════════════════════════════════════
     ROOM GEOMETRY
     Inner space: X[-5,5]  Y[0,4]  Z[-5,5]
     Player starts at (0,1.7,3.5) looking -Z
     Door at Z=+5 (behind player, opened to escape)
  ═══════════════════════════════════════════ */
  _buildRoom() {
    const W=10, H=4, D=10;
    const doorW=1.5, doorH=3.0;
    const sideW = (W - doorW) / 2;   // 4.25 each side

    const floorMat = this._std(0x6b5437, 0.95);
    const wallMat  = this._std(0xc4b49a, 0.88);
    const wallDkMt = this._std(0xb0a288, 0.88);
    const ceilMat  = this._std(0xd0ccbe, 0.90);
    const baseMat  = this._std(0x7a6142, 0.70);
    const framMat  = this._std(0x5a3310, 0.60);

    // Floor
    this._box(W, 0.12, D, [0,-0.06,0], floorMat, false, true);
    // Ceiling
    this._box(W, 0.12, D, [0, H+0.06, 0], ceilMat, false, true);

    // Back wall  (z = -5)
    this._box(W, H, 0.2, [0, H/2, -5.1], wallMat, false, true);
    // Left wall  (x = -5)
    this._box(0.2, H, D, [-5.1, H/2, 0], wallDkMt, false, true);
    // Right wall (x = +5)
    this._box(0.2, H, D, [5.1, H/2, 0], wallDkMt, false, true);

    // Front wall — left slice
    this._box(sideW, H, 0.2, [-5 + sideW/2, H/2, 5.1], wallMat, false, true);
    // Front wall — right slice
    this._box(sideW, H, 0.2, [5  - sideW/2, H/2, 5.1], wallMat, false, true);
    // Front wall — above door
    this._box(doorW, H-doorH, 0.2, [0, doorH+(H-doorH)/2, 5.1], wallMat, false, true);

    // Baseboards
    [[0,0.075,-4.98,W,0.15,0.07],  // back
     [0,0.075, 4.98,W,0.15,0.07],  // front
     [-4.98,0.075,0,0.07,0.15,D],  // left
     [ 4.98,0.075,0,0.07,0.15,D]]  // right
    .forEach(([x,y,z,w,h,d]) => this._box(w,h,d,[x,y,z],baseMat));

    // Door frame uprights & header
    this._box(0.12, doorH+0.12, 0.22, [-doorW/2-0.06, doorH/2, 5.1], framMat);
    this._box(0.12, doorH+0.12, 0.22, [ doorW/2+0.06, doorH/2, 5.1], framMat);
    this._box(doorW+0.24, 0.12, 0.22, [0, doorH+0.06, 5.1], framMat);

    // ── Collidables (AABB boxes) ──────────────
    this.collidables = [
      { min: new THREE.Vector3(-5.2, 0, -5.2), max: new THREE.Vector3( 5.2, H, -4.8) }, // back
      { min: new THREE.Vector3(-5.2, 0, -5.2), max: new THREE.Vector3(-4.8, H,  5.2) }, // left
      { min: new THREE.Vector3( 4.8, 0, -5.2), max: new THREE.Vector3( 5.2, H,  5.2) }, // right
      { min: new THREE.Vector3(-5.2, 0,  4.8), max: new THREE.Vector3(-0.75,H,  5.2) }, // front-L
      { min: new THREE.Vector3( 0.75,0,  4.8), max: new THREE.Vector3( 5.2, H,  5.2) }, // front-R
    ];

    // Door collision (removed when door opens)
    this._doorCollider = { min: new THREE.Vector3(-0.75,0,4.8), max: new THREE.Vector3(0.75,doorH,5.2) };
    this.collidables.push(this._doorCollider);

    // ── Door mesh ─────────────────────────────
    this._buildDoor(doorW, doorH);

    // ── Clue note on back wall ────────────────
    this._buildNote();
  }

  _buildDoor(doorW, doorH) {
    // Group — slides UP on open
    this.doorGroup = new THREE.Group();
    this.doorGroup.position.set(0, 0, 5.05);
    this.scene.add(this.doorGroup);

    // Main door plank
    const mat = this._std(0x8b4513, 0.70, 0.05);
    this.door = this._boxMesh(doorW, doorH, 0.09, mat);
    this.door.position.set(0, doorH/2, 0);
    this.door.castShadow = true;
    this.doorGroup.add(this.door);

    // Recessed panels (decorative)
    const panMat = this._std(0x73390e, 0.75);
    [-0.6, 0.6].forEach(y => {
      const p = this._boxMesh(doorW*0.68, doorH*0.32, 0.03, panMat);
      p.position.set(0, doorH/2 + y, 0.05);
      this.doorGroup.add(p);
    });

    // Handle
    const hdlMat = new THREE.MeshStandardMaterial({ color:0xffd700, metalness:0.9, roughness:0.15 });
    const hdl = this._boxMesh(0.06, 0.15, 0.06, hdlMat);
    hdl.position.set(doorW/2-0.2, doorH/2-0.1, 0.1);
    hdl.rotation.z = Math.PI/2;
    const hdl2 = this._boxMesh(0.14, 0.04, 0.04, hdlMat);
    hdl2.position.set(doorW/2-0.2, doorH/2-0.1, 0.1);
    this.doorGroup.add(hdl, hdl2);

    // Make door clickable (shows "locked" message)
    this.door.userData.name = 'door';
    this.interactables['door'] = this.door;
  }

  _buildNote() {
    // Canvas texture with handwritten-style text
    const cv  = document.createElement('canvas');
    cv.width  = 512; cv.height = 384;
    const ctx = cv.getContext('2d');

    // Paper
    const grad = ctx.createLinearGradient(0, 0, 512, 384);
    grad.addColorStop(0, '#f7edcf'); grad.addColorStop(1, '#ecd9a6');
    ctx.fillStyle = grad; ctx.fillRect(0,0,512,384);

    // Ruled lines
    ctx.strokeStyle = 'rgba(100,70,10,0.12)'; ctx.lineWidth=1;
    for (let y=50;y<384;y+=26){ ctx.beginPath(); ctx.moveTo(24,y); ctx.lineTo(488,y); ctx.stroke(); }

    // Red margin
    ctx.strokeStyle='rgba(180,30,30,0.3)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(56,0); ctx.lineTo(56,384); ctx.stroke();

    // Title
    ctx.fillStyle='#1a1008'; ctx.font='bold 26px Georgia,serif'; ctx.textAlign='center';
    ctx.fillText('✦  Secret Note  ✦',256,44);

    // Body
    ctx.font='italic 19px Georgia,serif'; ctx.fillStyle='#2d1f08';
    ['The ancient wardens spoke of', 'a code passed through time...', '', '"One — Three — Seven"', '', 'Enter it upon the lock'].forEach((line,i)=>{
      ctx.fillText(line,256,85+i*32);
    });

    // Big hint
    ctx.font='bold 28px Georgia,serif'; ctx.fillStyle='#7a0000';
    ctx.fillText('1  —  3  —  7',256,275);

    // Signature
    ctx.font='italic 15px Georgia,serif'; ctx.fillStyle='#5a4020';
    ctx.fillText('— The Warden',256,320);

    // Wax seal
    ctx.beginPath(); ctx.arc(256,358,18,0,Math.PI*2);
    ctx.fillStyle='#8b0000'; ctx.fill();
    ctx.fillStyle='#ffd700'; ctx.font='bold 18px serif'; ctx.fillText('⚜',256,365);

    // Frame (wooden)
    const frmMat = this._std(0x7a5920, 0.55);
    this._box(1.5, 1.1, 0.06, [-2.2, 2.5, -4.94], frmMat);

    // Note plane with canvas texture
    const tex  = new THREE.CanvasTexture(cv);
    const noteMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.95),
      new THREE.MeshStandardMaterial({ map: tex, roughness:1, side: THREE.DoubleSide })
    );
    noteMesh.position.set(-2.2, 2.5, -4.91);
    noteMesh.receiveShadow = true;
    this.scene.add(noteMesh);
    noteMesh.userData.name = 'note';
    this.interactables['note'] = noteMesh;
  }

  /* ═══════════════════════════════════════════
     FURNITURE
  ═══════════════════════════════════════════ */
  _buildFurniture() {
    const wood  = this._std(0x8b5e3c, 0.70, 0.03);
    const wdDrk = this._std(0x5c3317, 0.75);

    // ── TABLE (z=-2, centre) ─────────────────
    this._box(2.4, 0.08, 1.0, [0, 0.92, -2], this._std(0xa07040, 0.55, 0.05), true, true);
    [[-1.1,0.46,-2.4],[1.1,0.46,-2.4],[-1.1,0.46,-1.6],[1.1,0.46,-1.6]]
      .forEach(([x,y,z]) => this._box(0.09,0.92,0.09,[x,y,z], wood, false, true));
    this.collidables.push({
      min: new THREE.Vector3(-1.3, 0, -2.6),
      max: new THREE.Vector3( 1.3, 1.0, -1.4)
    });

    // ── BOOKSHELF (left wall, x=-5) ──────────
    const shelfMat = this._std(0x6b4226, 0.80);
    this._box(1.6,2.3,0.45,[-4.7,1.15,-2], shelfMat, true, true);
    [-0.3,0.45,1.2].forEach(y => this._box(1.4,0.05,0.4,[-4.7,0.3+y,-2], shelfMat));
    const bookCols = [0xcc3333,0x3355cc,0x228833,0xcc9922,0x993399,0x22aacc,0xdd5500];
    for(let i=0;i<7;i++){
      const bm = new THREE.MeshStandardMaterial({color:bookCols[i%bookCols.length],roughness:0.8});
      this._box(0.10,0.28+(i%3)*0.05,0.34,[-5.12+i*0.22,0.56+Math.floor(i/3)*0.75,-2],bm,true);
    }
    this.collidables.push({
      min: new THREE.Vector3(-5.1, 0, -2.8),
      max: new THREE.Vector3(-4.3, 2.4, -1.2)
    });

    // ── CHAIR ───────────────────────────────
    this._box(0.52,0.06,0.52,[0,0.50,-1.1], wdDrk, true, true); // seat
    this._box(0.52,0.65,0.06,[0,0.85,-0.87], wdDrk, true);      // backrest
    [[0.2,0.25,0.2],[-0.2,0.25,0.2],[0.2,0.25,-0.2],[-0.2,0.25,-0.2]]
      .forEach(([dx,y,dz]) => this._box(0.045,0.5,0.045,[dx,y,-1.1+dz],wdDrk));

    // ── DECORATIVE CRATE (right wall) ────────
    const crateMat = this._std(0x9b7540, 0.85);
    this._box(0.7,0.7,0.7,[3.6,0.35,-3], crateMat, true, true);
    this._box(0.72,0.04,0.04,[3.6,0.7,-3], this._std(0x7a5520,0.6));
    this._box(0.04,0.72,0.04,[3.6,0.36,-3], this._std(0x7a5520,0.6));
    this.collidables.push({
      min: new THREE.Vector3(3.2,0,-3.4),
      max: new THREE.Vector3(4.0,0.7,-2.6)
    });

    // ── WALL LAMP (right wall, z=-1) ─────────
    const wlMat = new THREE.MeshStandardMaterial({color:0x888888,metalness:0.7,roughness:0.3});
    this._box(0.08,0.22,0.25,[4.94,2.8,-1], wlMat);
    const wlLight = new THREE.PointLight(0xff9944, 1.8, 9);
    wlLight.position.set(4.7, 2.6, -1);
    this.scene.add(wlLight);
    const wlGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8),
      new THREE.MeshBasicMaterial({color:0xffdd99}));
    wlGlobe.position.set(4.85,2.65,-1);
    this.scene.add(wlGlobe);
  }

  /* ═══════════════════════════════════════════
     PUZZLE OBJECTS
  ═══════════════════════════════════════════ */
  _buildPuzzleObjects() {
    // ── CODE LOCK BOX on table ───────────────
    const lockMat   = this._std(0x1a1a1a, 0.25, 0.85);
    const lockBody  = this._box(0.38,0.28,0.20,[0.55,1.07,-2.05], lockMat, true, true);
    lockBody.userData.name = 'codeLock';
    this.interactables['codeLock'] = lockBody;

    // Screen glow
    const screenMat = new THREE.MeshStandardMaterial({
      color:0x003a00, emissive:new THREE.Color(0x00ff66),
      emissiveIntensity:0.35, roughness:0.1, metalness:0
    });
    const screen = this._box(0.26,0.10,0.01,[0.55,1.11,-1.95], screenMat);
    this.lockScreen = screen;

    // Digit dots on screen
    const dotMat = new THREE.MeshStandardMaterial({
      color:0x004400, emissive:new THREE.Color(0x00cc44), emissiveIntensity:0.4
    });
    [-0.07,0,0.07].forEach(dx =>
      this._box(0.035,0.035,0.01,[0.55+dx,1.085,-1.945], dotMat));

    // Metal shackle
    const shdMat = new THREE.MeshStandardMaterial({color:0x999999,metalness:0.92,roughness:0.15});
    this._box(0.04,0.13,0.04,[0.48,1.22,-2.02], shdMat);
    this._box(0.04,0.13,0.04,[0.62,1.22,-2.02], shdMat);
    this._box(0.18,0.04,0.04,[0.55,1.275,-2.02], shdMat);

    // Small screen glow point light
    const glowLight = new THREE.PointLight(0x00ff66, 0.25, 1.2);
    glowLight.position.set(0.55, 1.11, -1.8);
    this.scene.add(glowLight);
  }

  /* ═══════════════════════════════════════════
     DOOR ANIMATION — slide upward
  ═══════════════════════════════════════════ */
  openDoor() {
    if (this.doorOpen || this._doorAnim) return;
    this._doorAnim = true;

    // Remove door AABB from collidables
    const idx = this.collidables.indexOf(this._doorCollider);
    if (idx !== -1) this.collidables.splice(idx, 1);

    const startY  = this.doorGroup.position.y;
    const targetY = 4.5;
    const dur     = 1400;
    const t0      = performance.now();

    const animate = now => {
      const t  = Math.min((now - t0) / dur, 1);
      const e  = t<0.5 ? 2*t*t : -1+(4-2*t)*t; // ease-in-out
      this.doorGroup.position.y = startY + (targetY - startY) * e;
      if (t < 1) requestAnimationFrame(animate);
      else { this.doorOpen = true; this._doorAnim = false; }
    };
    requestAnimationFrame(animate);
  }

  /* ═══════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════ */
  _std(color, roughness=0.8, metalness=0.0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  _boxMesh(w,h,d, mat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  }

  _box(w,h,d, pos, mat, castShadow=false, receiveShadow=false) {
    const m = this._boxMesh(w,h,d, mat);
    m.position.set(...pos);
    m.castShadow    = castShadow;
    m.receiveShadow = receiveShadow;
    this.scene.add(m);
    return m;
  }

  render(camera) {
    this.renderer.render(this.scene, camera);
  }
}
