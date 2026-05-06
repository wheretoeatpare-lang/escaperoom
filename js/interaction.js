// interaction.js — Raycasting, hover highlight, click / E-key dispatch
import * as THREE from 'three';

const REACH = 3.8; // max interaction distance

const HINT_LABELS = {
  codeLock: '[E] Enter Code',
  note:     '[E] Read Note',
  door:     null, // set dynamically
};

export class Interaction {
  constructor(gameScene, player, puzzle) {
    this.gs      = gameScene;
    this.player  = player;
    this.puzzle  = puzzle;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = REACH;

    this.hovered   = null;       // currently hovered interactable mesh
    this._origEmissive = new Map(); // mesh → original emissive Color

    this.$hint = document.getElementById('interactHint');

    this._setupEvents();
  }

  /* ── Event wiring ───────────────────────── */
  _setupEvents() {
    // Click (left mouse) — only when pointer locked, no modal open
    document.addEventListener('click', () => {
      if (this.player.locked && !this._modalOpen() && this.hovered) {
        this._interact(this.hovered);
      }
    });

    // E key
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyE' && this.player.locked && !this._modalOpen() && this.hovered) {
        this._interact(this.hovered);
      }
    });
  }

  _modalOpen() {
    return document.getElementById('modal').classList.contains('open');
  }

  /* ── Per-frame update ───────────────────── */
  update() {
    if (!this.player.locked || this._modalOpen()) {
      this._clearHighlight();
      this.$hint.style.display = 'none';
      return;
    }

    // Cast from camera centre
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.player.camera);

    let closestDist = Infinity;
    let closestMesh = null;
    let closestName = null;

    for (const [name, mesh] of Object.entries(this.gs.interactables)) {
      const hits = this.raycaster.intersectObject(mesh, true);
      if (hits.length > 0 && hits[0].distance < closestDist) {
        closestDist = hits[0].distance;
        closestMesh = mesh;
        closestName = name;
      }
    }

    // Update highlight
    if (closestMesh !== this.hovered) {
      this._clearHighlight();
      if (closestMesh) this._highlight(closestMesh);
    }
    this.hovered = closestMesh;

    // Hint label
    if (closestMesh) {
      this.$hint.style.display = 'block';
      let label = HINT_LABELS[closestName];
      if (closestName === 'door') {
        label = this.gs.doorOpen ? '[E] EXIT ROOM →' : '[E] Door is locked';
      }
      this.$hint.textContent = label ?? '[E] Interact';
    } else {
      this.$hint.style.display = 'none';
    }
  }

  /* ── Interaction dispatch ───────────────── */
  _interact(mesh) {
    const name = mesh.userData.name;
    switch (name) {
      case 'codeLock':
        this.puzzle.openLock();
        break;
      case 'note':
        this.puzzle.openNote();
        break;
      case 'door':
        if (this.gs.doorOpen) {
          // Trigger win from here too (in case player didn't walk through)
          window._escapeRoomWin?.();
        } else {
          this.puzzle.showMessage('🔒 The door is sealed. Find the code!');
        }
        break;
    }
  }

  /* ── Hover Highlight ────────────────────── */
  _highlight(mesh) {
    // Walk the mesh and all children
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
