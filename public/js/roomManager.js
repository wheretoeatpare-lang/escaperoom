// roomManager.js — Manages room transitions, current room state, overall game progress
import * as THREE from 'three';

export class RoomManager {
  constructor(scene, player, renderer) {
    this.scene    = scene;
    this.player   = player;
    this.renderer = renderer;

    this.currentRoom = 1;    // 1, 2, or 3
    this.totalRooms  = 3;
    this.rooms       = {};   // roomNum → RoomInstance

    // Transition state
    this._transitioning = false;
    this._overlay       = null;
    this._buildOverlay();

    // Room-change callbacks
    this.onRoomChanged = null; // (roomNum) => void
    this.onAllRoomsComplete = null; // () => void
  }

  _buildOverlay() {
    this._overlay = document.createElement('div');
    Object.assign(this._overlay.style, {
      position: 'fixed', inset: '0',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '500',
      transition: 'opacity 0.7s ease',
    });
    document.body.appendChild(this._overlay);
  }

  registerRoom(num, roomInstance) {
    this.rooms[num] = roomInstance;
  }

  /* ── Transition to next room ── */
  async transitionTo(roomNum, puzzle) {
    if (this._transitioning) return;
    this._transitioning = true;

    // Fade out
    this._overlay.style.pointerEvents = 'all';
    this._overlay.style.opacity = '1';
    await this._wait(750);

    // Tear down current room objects
    const oldRoom = this.rooms[this.currentRoom];
    if (oldRoom) oldRoom.destroy(this.scene);

    // Clear interactables & collidables from GameScene shell
    Object.keys(puzzle.gs.interactables).forEach(k => delete puzzle.gs.interactables[k]);
    puzzle.gs.collidables.length = 0;
    puzzle.gs.doorOpen   = false;
    puzzle.gs._doorAnim  = false;
    puzzle.gs.doorGroup  = null;
    puzzle.gs.door       = null;

    // Build new room
    this.currentRoom = roomNum;
    const newRoom = this.rooms[roomNum];
    newRoom.build(this.scene, puzzle.gs);

    // Reposition player
    const spawn = newRoom.spawnPoint();
    this.player.position.copy(spawn.pos);
    this.player.yaw   = spawn.yaw;
    this.player.pitch = 0;

    // Update HUD
    this._updateRoomHUD(roomNum);
    if (this.onRoomChanged) this.onRoomChanged(roomNum);

    await this._wait(200);

    // Fade in
    this._overlay.style.opacity = '0';
    this._overlay.style.pointerEvents = 'none';
    await this._wait(750);

    this._transitioning = false;
  }

  _updateRoomHUD(num) {
    const el = document.getElementById('roomIndicator');
    if (el) el.textContent = `Room ${num} / ${this.totalRooms}`;
  }

  _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  isTransitioning() { return this._transitioning; }
}
