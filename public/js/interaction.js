// interaction.js -- Raycasting, hover highlight, click / E-key dispatch + sounds
import * as THREE from 'three';

const REACH = 3.8;

export class Interaction {
  constructor(gameScene, player, puzzle, snd) {
    this.gs     = gameScene;
    this.player = player;
    this.puzzle = puzzle;
    this.snd    = snd || window._snd || null;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = REACH;

    this.hovered = null;
    this._origEmissive = new Map();
    this.$hint = document.getElementById('interactHint');

    this._setupEvents();
  }

  _setupEvents() {
    document.addEventListener('click', () => {
      if (this.player.locked && !this._modalOpen() && this.hovered) {
        this._interact(this.hovered);
      }
    });
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyE' && this.player.locked && !this._modalOpen() && this.hovered) {
        this._interact(this.hovered);
      }
    });
  }

  _modalOpen() {
    return document.getElementById('modal').classList.contains('open');
  }

  update() {
    if (!this.player.locked || this._modalOpen()) {
      this._clearHighlight();
      this.$hint.style.display = 'none';
      return;
    }

    this.raycaster.setFromCamera(new THREE.Vector2(0,0), this.player.camera);

    let closestDist = Infinity, closestMesh = null, closestName = null;

    for (const [name, mesh] of Object.entries(this.gs.interactables)) {
      const hits = this.raycaster.intersectObject(mesh, true);
      if (hits.length > 0 && hits[0].distance < closestDist) {
        closestDist = hits[0].distance;
        closestMesh = mesh;
        closestName = name;
      }
    }

    if (closestMesh !== this.hovered) {
      this._clearHighlight();
      if (closestMesh) this._highlight(closestMesh);
    }
    this.hovered = closestMesh;

    if (closestMesh) {
      this.$hint.style.display = 'block';
      this.$hint.textContent   = this._hintFor(closestName, closestMesh);
    } else {
      this.$hint.style.display = 'none';
    }
  }

  _hintFor(name, mesh) {
    if (name === 'codeLock')   return '[E] Enter Code';
    if (name === 'note')       return '[E] Read Note';
    if (name === 'symbolRef')  return '[E] Read Symbol Order';
    if (name === 'simonStart') {
      const room = this.puzzle.activeRoom;
      if (room?.simonSolved) return 'Simon: Complete!';
      if (room?._simonState?.phase === 'showing') return 'Watch the sequence...';
      if (room?._simonState?.phase === 'input')   return 'Repeat the sequence!';
      return '[E] Start Simon Says';
    }
    if (name === 'door') {
      return this.gs.doorOpen ? '[E] EXIT -->' : '[E] Door is locked';
    }
    if (name.startsWith('symPanel_')) {
      const sym = mesh.userData.sym || '?';
      return `[E] Press Symbol  ${sym}`;
    }
    if (name.startsWith('simon') && name !== 'simonStart') {
      const room = this.puzzle.activeRoom;
      if (room?.simonSolved) return 'Simon: Complete!';
      if (room?._simonState?.phase === 'input') return '[E] Press this pad!';
      return 'Wait for your turn...';
    }
    if (name.startsWith('fragment_')) {
      return `[E] Collect Key Fragment`;
    }
    return '[E] Interact';
  }

  _interact(mesh) {
    const name = mesh.userData.name;

    // Room 1
    if (name === 'codeLock') { this.puzzle.openLock(); return; }
    if (name === 'note')     { this.puzzle.openNote(); return; }

    // Room 2: Symbol panels
    if (name.startsWith('symPanel_')) {
      this.snd?.playSymbolPress();
      this.puzzle.pressSymbolPanel(mesh.userData.sym, mesh);
      return;
    }
    // Room 2: Symbol reference card
    if (name === 'symbolRef') { this.puzzle.openSymbolRef(); return; }

    // Room 2: Simon Says start
    if (name === 'simonStart') {
      this.puzzle.startSimon();
      return;
    }
    // Room 2: Simon pads
    if (name.startsWith('simon') && name !== 'simonStart') {
      const idx = mesh.userData.simonIdx;
      if (idx !== undefined) {
        this.snd?.playSimonPad(idx);
        this.puzzle.pressSimonPad(idx);
      }
      return;
    }

    // Room 3: Fragments
    if (name.startsWith('fragment_')) {
      const idx = mesh.userData.fragIdx;
      if (idx !== undefined) this.puzzle.collectFragment(idx);
      return;
    }

    // Door (all rooms)
    if (name === 'door') {
      if (this.gs.doorOpen) {
        window._escapeRoomWin?.();
      } else {
        this.snd?.playError();
        this.puzzle.showMessage('The door is sealed. Solve the puzzles first!');
      }
      return;
    }
  }

  _highlight(mesh) {
    mesh.traverse(child => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        if (!mat.emissive) return;
        if (!this._origEmissive.has(child)) {
          this._origEmissive.set(child, {
            color: mat.emissive.clone(),
            intensity: mat.emissiveIntensity ?? 0
          });
        }
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = 0.13;
      });
    });
  }

  _clearHighlight() {
    if (!this.hovered) return;
    this.hovered.traverse(child => {
      if (!child.isMesh) return;
      const saved = this._origEmissive.get(child);
      if (!saved) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        if (!mat.emissive) return;
        mat.emissive.copy(saved.color);
        mat.emissiveIntensity = saved.intensity;
      });
      this._origEmissive.delete(child);
    });
  }
}
