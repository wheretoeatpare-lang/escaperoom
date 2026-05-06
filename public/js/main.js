// main.js — Entry point: wires all rooms, manager, and game loop
import { GameScene   } from './scene.js';
import { Player      } from './player.js';
import { Interaction } from './interaction.js';
import { Puzzle      } from './puzzle.js';
import { Multiplayer } from './multiplayer.js';
import { RoomManager } from './roomManager.js';
import { Room2       } from './room2.js';
import { Room3       } from './room3.js';

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */
const gs = new GameScene();
gs.init();

const player = new Player(gs);
player.position.set(0, 1.72, 3.5);
player.yaw = 0;

const mp = new Multiplayer(gs);
const pz = new Puzzle(gs);
const ix = new Interaction(gs, player, pz);

// Room instances
const room2 = new Room2();
const room3 = new Room3();

// Room manager
const rm = new RoomManager(gs.scene, player, gs.renderer);
rm.registerRoom(1, null);   // Room 1 is built by GameScene directly
rm.registerRoom(2, room2);
rm.registerRoom(3, room3);

/* ═══════════════════════════════════════════
   ROOM 2 CALLBACKS
═══════════════════════════════════════════ */
room2.onBothSolved = () => {
  pz._toast('🎉 Both puzzles solved! The exit is open!');
  _updateObjectivesForRoom(2, true);
};

/* ═══════════════════════════════════════════
   ROOM 3 CALLBACKS
═══════════════════════════════════════════ */
room3.onAllFragmentsFound = () => {
  pz._toast('🗝 All key fragments found! The vault door opens!');
  _updateObjectivesForRoom(3, true);
};

/* ═══════════════════════════════════════════
   ROOM MANAGER CALLBACK
═══════════════════════════════════════════ */
rm.onRoomChanged = (roomNum) => {
  pz.currentRoom  = roomNum;
  pz.activeRoom   = roomNum === 2 ? room2 : roomNum === 3 ? room3 : null;
  _setupObjectivesForRoom(roomNum);
  // Update gs.doorOpen gate for walk-through detection
  gs.doorOpen = false;
};

/* ═══════════════════════════════════════════
   MULTIPLAYER
═══════════════════════════════════════════ */
mp.onPuzzleSolved = () => pz.remoteSolve();
pz.onSolved       = () => mp.sendPuzzleSolved();

mp.connect('wss://escaperoom-production-501d.up.railway.app');

/* ═══════════════════════════════════════════
   POSITION SYNC — 20 Hz
═══════════════════════════════════════════ */
setInterval(() => {
  if (player.locked) mp.sendMove(player.serialize());
}, 50);

/* ═══════════════════════════════════════════
   WIN TRIGGER
═══════════════════════════════════════════ */
let winTriggered = false;
window._escapeRoomWin = () => {
  if (winTriggered) return;
  winTriggered = true;

  // Mark final objective
  _markObj('obj3');

  player.unlock();
  const win     = document.getElementById('winScreen');
  const winTime = document.getElementById('winTime');
  win.style.display   = 'flex';
  winTime.textContent = `⏱ Total time: ${pz.getElapsed()}`;
};

/* ═══════════════════════════════════════════
   ROOM TRANSITION — walk through door
   Room 1→2: player.z > 4.75 (north door of room 1)
   Room 2→3: player.z < -4.75 (north door of room 2)
   Room 3→win: player.z < -4.75 (north door of room 3)
═══════════════════════════════════════════ */
async function handleRoomTransition() {
  const r = pz.currentRoom;

  if (r === 1 && gs.doorOpen && player.position.z > 4.75) {
    // Entered door of room 1 → go to room 2
    _markObj('obj3');
    await rm.transitionTo(2, pz);
    pz.showMessage('🏛 You entered the Library of Symbols!\n\nSolve two puzzles to proceed:\n• Match the symbol sequence on the north wall\n• Repeat the Simon Says color pattern');
    return;
  }

  if (r === 2 && room2.doorOpen && player.position.z < -4.75) {
    // Exited room 2 → go to room 3
    await rm.transitionTo(3, pz);
    pz.showMessage('💀 You entered The Vault!\n\nFind all 3 golden key fragments hidden around the room to unlock the final door!');
    return;
  }

  if (r === 3 && room3.doorOpen && player.position.z < -4.75) {
    // Final escape!
    window._escapeRoomWin();
  }
}

/* ═══════════════════════════════════════════
   OBJECTIVES HUD PER ROOM
═══════════════════════════════════════════ */
function _setupObjectivesForRoom(num) {
  const objDiv = document.getElementById('objectives');
  if (!objDiv) return;

  const configs = {
    1: [
      { id:'obj1', text:'Find the secret note' },
      { id:'obj2', text:'Enter the code on the lock' },
      { id:'obj3', text:'Escape through the door' },
    ],
    2: [
      { id:'obj1', text:'Match the symbol sequence' },
      { id:'obj2', text:'Repeat the Simon Says pattern' },
      { id:'obj3', text:'Exit through the north door' },
    ],
    3: [
      { id:'obj1', text:'Find all 3 key fragments' },
      { id:'obj2', text:'The vault door will unlock' },
      { id:'obj3', text:'Escape through the final door' },
    ],
  };

  const items = configs[num] || configs[1];
  // Rebuild objective items
  ['obj1','obj2','obj3'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('done');
    el.innerHTML = `<span class="obj-pending">○</span> ${items[i].text}`;
  });

  // Update room indicator
  const ri = document.getElementById('roomIndicator');
  if (ri) ri.textContent = `Room ${num} / 3`;
}

function _updateObjectivesForRoom(roomNum, allSolved) {
  if (roomNum === 2) {
    if (room2.symbolSolved) _markObj('obj1');
    if (room2.simonSolved)  _markObj('obj2');
  }
  if (roomNum === 3) {
    if (room3._fragmentsFound >= 3) { _markObj('obj1'); _markObj('obj2'); }
  }
}

function _markObj(id) {
  const el = document.getElementById(id);
  if (el && !el.classList.contains('done')) {
    el.classList.add('done');
    const sp = el.querySelector('.obj-pending,.obj-check');
    if (sp) { sp.className = 'obj-check'; sp.textContent = '✓'; }
  }
}

/* ═══════════════════════════════════════════
   START SCREEN
═══════════════════════════════════════════ */
const $start = document.getElementById('startScreen');
$start.addEventListener('click', () => {
  $start.style.display = 'none';
  player.lock();
});

document.getElementById('gameCanvas').addEventListener('click', () => {
  const modal = document.getElementById('modal');
  if (!modal.classList.contains('open') && !winTriggered) {
    player.lock();
  }
});

document.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    const modal = document.getElementById('modal');
    if (modal.classList.contains('open')) pz.close();
  }
});

/* ═══════════════════════════════════════════
   GAME LOOP
═══════════════════════════════════════════ */
let lastT = performance.now();

function loop(now) {
  requestAnimationFrame(loop);

  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  player.update(dt);
  ix.update();
  mp.update(dt);

  // Per-room updates (animations, flicker, etc.)
  if (pz.currentRoom === 3 && room3) room3.update(dt);

  // Room transition check (only when not transitioning)
  if (!winTriggered && !rm.isTransitioning()) {
    handleRoomTransition();
  }

  gs.render(player.camera);
}

requestAnimationFrame(loop);

/* ═══════════════════════════════════════════
   DEBUG
═══════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === '`') {
    const p = player.position;
    console.log(`Room ${pz.currentRoom} | pos=(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) yaw=${player.yaw.toFixed(2)}`);
  }
});
