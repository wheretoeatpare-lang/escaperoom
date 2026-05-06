// main.js — Entry point: wires everything together and runs the game loop
import { GameScene   } from './scene.js';
import { Player      } from './player.js';
import { Interaction } from './interaction.js';
import { Puzzle      } from './puzzle.js';
import { Multiplayer } from './multiplayer.js';

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */
const gs   = new GameScene();
gs.init();

const player = new Player(gs);
player.position.set(0, 1.72, 3.5);
player.yaw = 0; // looking toward -Z (into the room, away from door)

const mp    = new Multiplayer(gs);
const pz    = new Puzzle(gs);
const ix    = new Interaction(gs, player, pz);

// Wire multiplayer callbacks
mp.onPuzzleSolved = () => pz.remoteSolve();
pz.onSolved       = () => mp.sendPuzzleSolved();

// Attempt multiplayer connection (graceful fallback if server absent)
mp.connect('ws://localhost:8080');

/* ═══════════════════════════════════════════
   POSITION SYNC — 20 Hz
═══════════════════════════════════════════ */
setInterval(() => {
  if (player.locked) mp.sendMove(player.serialize());
}, 50);

/* ═══════════════════════════════════════════
   WIN TRIGGER — walk through door
═══════════════════════════════════════════ */
let winTriggered = false;
window._escapeRoomWin = () => {
  if (winTriggered) return;
  winTriggered = true;

  // Mark final objective
  const obj3 = document.getElementById('obj3');
  if (obj3) {
    obj3.classList.add('done');
    const sp = obj3.querySelector('.obj-pending,.obj-check');
    if (sp) { sp.className='obj-check'; sp.textContent='✓'; }
  }

  player.unlock();
  const win     = document.getElementById('winScreen');
  const winTime = document.getElementById('winTime');
  win.style.display   = 'flex';
  winTime.textContent = `⏱ Your time: ${pz.getElapsed()}`;
};

/* ═══════════════════════════════════════════
   START SCREEN
═══════════════════════════════════════════ */
const $start = document.getElementById('startScreen');
$start.addEventListener('click', () => {
  $start.style.display = 'none';
  player.lock();
});

// Re-lock on canvas click if no modal open
document.getElementById('gameCanvas').addEventListener('click', () => {
  const modal = document.getElementById('modal');
  if (!modal.classList.contains('open') && !winTriggered) {
    player.lock();
  }
});

// ESC re-shows nothing, just unlocks — handled by browser automatically
document.addEventListener('keydown', e => {
  // ESC while pointer locked → browser releases automatically
  // Re-lock on next canvas click (handled above)
  if (e.code === 'Escape') {
    const modal = document.getElementById('modal');
    if (modal.classList.contains('open')) {
      pz.close();
    }
  }
});

/* ═══════════════════════════════════════════
   GAME LOOP
═══════════════════════════════════════════ */
let lastT = performance.now();

function loop(now) {
  requestAnimationFrame(loop);

  const dt = Math.min((now - lastT) / 1000, 0.05); // cap at 50 ms
  lastT = now;

  player.update(dt);
  ix.update();
  mp.update(dt);

  // Walk-through-door win trigger
  if (!winTriggered && gs.doorOpen && player.position.z > 4.75) {
    window._escapeRoomWin();
  }

  gs.render(player.camera);
}

requestAnimationFrame(loop);

/* ═══════════════════════════════════════════
   DEBUG — press ` to print position
═══════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === '`') {
    const p = player.position;
    console.log(`pos=(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) yaw=${player.yaw.toFixed(2)}`);
  }
});
