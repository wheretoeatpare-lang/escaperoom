// main.js — Entry point: wires all rooms, manager, sound, and game loop
import { GameScene   } from './scene.js';
import { Player      } from './player.js';
import { Interaction } from './interaction.js';
import { Puzzle      } from './puzzle.js';
import { Multiplayer } from './multiplayer.js';
import { RoomManager } from './roomManager.js';
import { Room2       } from './room2.js';
import { Room3       } from './room3.js';
import { SoundManager} from './sound.js';

/* =========================================
   BOOT
========================================= */
const gs  = new GameScene();
gs.init();

const snd = new SoundManager();
window._snd = snd; // expose globally so puzzle.js / interaction.js can reach it

const player = new Player(gs);
player.position.set(0, 1.72, 3.5);
player.yaw = 0;

const mp = new Multiplayer(gs);
const pz = new Puzzle(gs, snd);
const ix = new Interaction(gs, player, pz, snd);

const room2 = new Room2();
const room3 = new Room3();

const rm = new RoomManager(gs.scene, player, gs.renderer);
rm.registerRoom(1, null);
rm.registerRoom(2, room2);
rm.registerRoom(3, room3);

/* =========================================
   ROOM 2 CALLBACKS
========================================= */
room2.onBothSolved = () => {
  snd.playDoorOpen();
  pz._toast('Both puzzles solved! The exit door is open!');
  _updateObjectivesForRoom(2, true);
};

/* =========================================
   ROOM 3 CALLBACKS
========================================= */
room3.onAllFragmentsFound = () => {
  snd.playDoorOpen();
  pz._toast('All key fragments found! The vault door opens!');
  _updateObjectivesForRoom(3, true);
};

/* =========================================
   ROOM MANAGER CALLBACK
========================================= */
rm.onRoomChanged = (roomNum) => {
  pz.currentRoom  = roomNum;
  pz.activeRoom   = roomNum === 2 ? room2 : roomNum === 3 ? room3 : null;
  _setupObjectivesForRoom(roomNum);
  gs.doorOpen = false;
  snd.startAmbientHum(roomNum);
};

/* =========================================
   MULTIPLAYER
========================================= */
mp.onPuzzleSolved = () => pz.remoteSolve();
pz.onSolved       = () => mp.sendPuzzleSolved();
mp.connect('wss://escaperoom-production-501d.up.railway.app');

/* =========================================
   POSITION SYNC — 20 Hz
========================================= */
setInterval(() => {
  if (player.locked) mp.sendMove(player.serialize());
}, 50);

/* =========================================
   FOOTSTEP SOUNDS
========================================= */
let _footstepTimer = 0;
let _footstepInterval = 0.42; // seconds between steps

/* =========================================
   WIN TRIGGER
========================================= */
let winTriggered = false;
window._escapeRoomWin = () => {
  if (winTriggered) return;
  winTriggered = true;
  _markObj('obj3');
  snd.stopAmbientHum();
  snd.playWin();
  player.unlock();
  const win     = document.getElementById('winScreen');
  const winTime = document.getElementById('winTime');
  win.style.display   = 'flex';
  winTime.textContent = `Your time: ${pz.getElapsed()}`;
};

/* =========================================
   ROOM TRANSITION
========================================= */
async function handleRoomTransition() {
  const r = pz.currentRoom;

  if (r === 1 && gs.doorOpen && player.position.z > 4.75) {
    _markObj('obj3');
    snd.stopAmbientHum();
    snd.playRoomTransition();
    await rm.transitionTo(2, pz);
    pz.showMessage('You entered the Library of Symbols!\n\nSolve two puzzles to proceed:\n• Match the symbol sequence on the north wall\n• Repeat the Simon Says color pattern on the pedestal');
    return;
  }

  if (r === 2 && room2.doorOpen && player.position.z < -4.75) {
    snd.stopAmbientHum();
    snd.playRoomTransition();
    await rm.transitionTo(3, pz);
    pz.showMessage('You entered The Vault!\n\nFind all 3 golden key fragments hidden around the room to unlock the final door!');
    return;
  }

  if (r === 3 && room3.doorOpen && player.position.z < -4.75) {
    window._escapeRoomWin();
  }
}

/* =========================================
   OBJECTIVES HUD
========================================= */
function _setupObjectivesForRoom(num) {
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
  ['obj1','obj2','obj3'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('done');
    el.innerHTML = `<span class="obj-pending">○</span> ${items[i].text}`;
  });
  const ri = document.getElementById('roomIndicator');
  if (ri) ri.textContent = `Room ${num} / 3`;
}

function _updateObjectivesForRoom(roomNum) {
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

/* =========================================
   START SCREEN
========================================= */
const $start = document.getElementById('startScreen');
$start.addEventListener('click', () => {
  $start.style.display = 'none';
  player.lock();
  snd.resume();
  snd.startAmbientHum(1);
});

document.getElementById('gameCanvas').addEventListener('click', () => {
  snd.resume();
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

/* =========================================
   GAME LOOP
========================================= */
let lastT = performance.now();
let _moving = false;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  player.update(dt);
  ix.update();
  mp.update(dt);

  // Footsteps
  const wasMoving = _moving;
  const p = player.position;
  _moving = player.locked && (player.keys['KeyW'] || player.keys['KeyS'] ||
            player.keys['KeyA'] || player.keys['KeyD'] ||
            player.keys['ArrowUp'] || player.keys['ArrowDown'] ||
            player.keys['ArrowLeft'] || player.keys['ArrowRight']);

  if (_moving) {
    _footstepTimer -= dt;
    if (_footstepTimer <= 0) {
      snd.playFootstep();
      _footstepTimer = _footstepInterval;
    }
  } else {
    _footstepTimer = 0;
  }

  // Per-room updates
  if (pz.currentRoom === 3 && room3) room3.update(dt);

  // Room transition check
  if (!winTriggered && !rm.isTransitioning()) {
    handleRoomTransition();
  }

  gs.render(player.camera);
}

requestAnimationFrame(loop);

/* =========================================
   DEBUG
========================================= */
document.addEventListener('keydown', e => {
  if (e.key === '`') {
    const p = player.position;
    console.log(`Room ${pz.currentRoom} | pos=(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) yaw=${player.yaw.toFixed(2)}`);
  }
});
