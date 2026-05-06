// player.js — First-person controller: pointer lock, WASD, pitch/yaw, AABB collision
import * as THREE from 'three';

export class Player {
  constructor(gameScene) {
    this.gs = gameScene;

    // Camera
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.05, 80);

    // World-space position (eye level)
    this.position = new THREE.Vector3(0, 1.72, 3.5);

    // Rotation
    this.yaw   = 0;   // horizontal (radians)  — 0 = looking -Z
    this.pitch = 0;   // vertical (radians)

    // Movement
    this.speed   = 4.2;
    this.keys    = {};
    this.locked  = false;   // pointer lock active
    this.paused  = false;   // externally paused (modal open)

    // Bob
    this._bobT   = 0;
    this._bobAmp = 0.022;
    this._bobFreq= 5.5;

    this._init();
  }

  _init() {
    // Key tracking
    document.addEventListener('keydown', e => { this.keys[e.code] = true; });
    document.addEventListener('keyup',   e => { this.keys[e.code] = false; });

    // Mouse look
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.yaw   -= e.movementX * 0.0018;
      this.pitch -= e.movementY * 0.0018;
      this.pitch  = Math.max(-1.3, Math.min(1.3, this.pitch));
    });

    // Pointer lock change
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === document.getElementById('gameCanvas');
    });

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  /* ── Pointer Lock ───────────────────────── */
  lock() {
    document.getElementById('gameCanvas').requestPointerLock();
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /* ── Per-frame update ───────────────────── */
  update(dt) {
    if (!this.locked || this.paused) {
      this._applyCamera();
      return;
    }
    // Also skip if puzzle modal is open
    if (document.getElementById('modal').classList.contains('open')) {
      this._applyCamera();
      return;
    }

    // Direction vectors (XZ only, no tilt)
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const fwd = new THREE.Vector3(-sinY, 0, -cosY);
    const rgt = new THREE.Vector3( cosY, 0, -sinY);

    let dx=0, dz=0;
    if (this.keys['KeyW']||this.keys['ArrowUp'])    { dx+=fwd.x; dz+=fwd.z; }
    if (this.keys['KeyS']||this.keys['ArrowDown'])  { dx-=fwd.x; dz-=fwd.z; }
    if (this.keys['KeyA']||this.keys['ArrowLeft'])  { dx-=rgt.x; dz-=rgt.z; }
    if (this.keys['KeyD']||this.keys['ArrowRight']) { dx+=rgt.x; dz+=rgt.z; }

    const len = Math.sqrt(dx*dx+dz*dz);
    if (len > 0) { dx/=len; dz/=len; }

    const dist = this.speed * dt;
    const isMoving = len > 0;

    // Slide-based collision: try X then Z independently
    const nx = this.position.x + dx*dist;
    const nz = this.position.z + dz*dist;

    if (!this._collides(nx, this.position.y, this.position.z))
      this.position.x = nx;

    if (!this._collides(this.position.x, this.position.y, nz))
      this.position.z = nz;

    // Head bob
    if (isMoving) {
      this._bobT += dt * this._bobFreq;
    } else {
      // Decay bob back to zero smoothly
      this._bobT = this._bobT - dt * this._bobFreq * 0.4;
    }

    this._applyCamera();
  }

  _applyCamera() {
    // Bob offset
    const bob = Math.sin(this._bobT) * this._bobAmp;

    this.camera.position.set(
      this.position.x,
      this.position.y + bob,
      this.position.z
    );

    const qYaw   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this.pitch);
    this.camera.quaternion.copy(qYaw).multiply(qPitch);
  }

  /* ── AABB Collision ─────────────────────── */
  _collides(x, y, z) {
    // Player bounding box: radius 0.28, height 0→1.85 relative to y
    const RADIUS = 0.28;
    const pMin = new THREE.Vector3(x-RADIUS, y-1.68, z-RADIUS);
    const pMax = new THREE.Vector3(x+RADIUS, y+0.12, z+RADIUS);

    for (const box of this.gs.collidables) {
      if (pMax.x > box.min.x && pMin.x < box.max.x &&
          pMax.y > box.min.y && pMin.y < box.max.y &&
          pMax.z > box.min.z && pMin.z < box.max.z) {
        return true;
      }
    }
    return false;
  }

  /* ── Network data ───────────────────────── */
  serialize() {
    return {
      x:  parseFloat(this.position.x.toFixed(3)),
      y:  parseFloat(this.position.y.toFixed(3)),
      z:  parseFloat(this.position.z.toFixed(3)),
      ry: parseFloat(this.yaw.toFixed(4))
    };
  }
}
