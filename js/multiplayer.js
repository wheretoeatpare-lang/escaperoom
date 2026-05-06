// multiplayer.js — WebSocket client, remote player avatars, state sync
import * as THREE from 'three';

const PLAYER_COLORS = ['#ff4444','#44aaff','#44ff88','#ffaa22','#dd44ff','#ff88aa'];

export class Multiplayer {
  constructor(gameScene) {
    this.gs        = gameScene;
    this.ws        = null;
    this.localId   = null;
    this.localColor= null;
    this.peers     = new Map();   // id → { group, color, targetPos, targetRY }
    this.connected = false;

    // Callbacks
    this.onPuzzleSolved = null;   // () => void

    this.$playerList = document.getElementById('playerList');
  }

  /* ── Connect ────────────────────────────── */
  connect(url = 'ws://localhost:8080') {
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen    = ()  => { this.connected = true; console.log('[MP] connected'); };
      this.ws.onmessage = e   => this._onMessage(e);
      this.ws.onclose   = ()  => { this.connected = false; this._updateList(); };
      this.ws.onerror   = ()  => { this.connected = false; console.warn('[MP] offline mode'); };
    } catch {
      console.warn('[MP] WebSocket unavailable — single-player mode');
    }
  }

  /* ── Outbound ───────────────────────────── */
  sendMove(data) {
    this._send({ type:'move', ...data });
  }
  sendPuzzleSolved() {
    this._send({ type:'puzzleSolved' });
  }
  _send(obj) {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  /* ── Inbound ────────────────────────────── */
  _onMessage(e) {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    switch (msg.type) {
      case 'init':
        this.localId    = msg.id;
        this.localColor = msg.color;
        // Spawn existing players
        msg.players.forEach(p => { if (p.id !== this.localId) this._spawnPeer(p); });
        if (msg.puzzleSolved && this.onPuzzleSolved) this.onPuzzleSolved();
        this._updateList();
        break;

      case 'playerJoined':
        if (msg.player.id !== this.localId) {
          this._spawnPeer(msg.player);
          this._updateList();
        }
        break;

      case 'playerLeft':
        this._removePeer(msg.id);
        this._updateList();
        break;

      case 'playerMoved':
        if (msg.id !== this.localId) this._movePeer(msg);
        break;

      case 'puzzleSolved':
        if (this.onPuzzleSolved) this.onPuzzleSolved();
        break;
    }
  }

  /* ── Peer avatar creation ───────────────── */
  _spawnPeer(data) {
    if (this.peers.has(data.id)) return;

    const color = data.color || PLAYER_COLORS[this.peers.size % PLAYER_COLORS.length];
    const group = new THREE.Group();

    // Body cylinder
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness:0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,1.15,10), bodyMat);
    body.position.y = 0.575;
    body.castShadow = true;
    group.add(body);

    // Head sphere
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10), bodyMat);
    head.position.y = 1.5;
    head.castShadow = true;
    group.add(head);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [-0.08, 0.08].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038,6,6), eyeMat);
      eye.position.set(x, 1.52, -0.19);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.02,4,4), pupilMat);
      pupil.position.set(x, 1.52, -0.228);
      group.add(eye, pupil);
    });

    // Colour stripe / "belt"
    const stripeMat = new THREE.MeshBasicMaterial({ color });
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.08,10), stripeMat);
    stripe.position.y = 0.72;
    group.add(stripe);

    // Nametag floating above head (tiny box)
    const tagMat = new THREE.MeshBasicMaterial({ color });
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.12,0.01), tagMat);
    tag.position.y = 1.88;
    group.add(tag);

    group.position.set(data.x||0, data.y||0, data.z||0);
    this.gs.scene.add(group);

    this.peers.set(data.id, {
      group,
      color,
      targetPos: new THREE.Vector3(data.x||0, data.y||0, data.z||0),
      targetRY : data.ry || 0,
    });
  }

  _removePeer(id) {
    const peer = this.peers.get(id);
    if (peer) { this.gs.scene.remove(peer.group); this.peers.delete(id); }
  }

  _movePeer(data) {
    const peer = this.peers.get(data.id);
    if (!peer) return;
    // Store target for smooth interpolation
    peer.targetPos.set(data.x, data.y, data.z);
    peer.targetRY = data.ry;
  }

  /* ── Per-frame smooth interpolation ─────── */
  update(dt) {
    const LERP = Math.min(dt * 14, 1);
    for (const peer of this.peers.values()) {
      peer.group.position.lerp(peer.targetPos, LERP);
      peer.group.rotation.y += (peer.targetRY - peer.group.rotation.y) * LERP;
    }
  }

  /* ── Player list HUD ────────────────────── */
  _updateList() {
    const items = [];
    if (this.localColor) {
      items.push(`<div class="playerItem">
        <span class="playerDot" style="background:${this.localColor}"></span>You
      </div>`);
    }
    for (const [, peer] of this.peers) {
      items.push(`<div class="playerItem">
        <span class="playerDot" style="background:${peer.color}"></span>Player
      </div>`);
    }
    this.$playerList.innerHTML = items.join('');
  }
}
