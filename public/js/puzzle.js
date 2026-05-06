// puzzle.js -- Unified puzzle controller for all rooms, with sound
export class Puzzle {
  constructor(gameScene, snd) {
    this.gs   = gameScene;
    this.snd  = snd || window._snd || null;

    this.solved  = false;
    this.SECRET  = '137';
    this._startTime = Date.now();

    this.activeRoom  = null;
    this.currentRoom = 1;

    this.$modal       = document.getElementById('modal');
    this.$title       = document.getElementById('modalTitle');
    this.$noteContent = document.getElementById('noteContent');
    this.$lockUI      = document.getElementById('lockUI');
    this.$noteClose   = document.getElementById('noteClose');
    this.$error       = document.getElementById('errorMsg');
    this.$digits      = [
      document.getElementById('d0'),
      document.getElementById('d1'),
      document.getElementById('d2'),
    ];

    this.onSolved    = null;
    this.onRoomClear = null;

    this._initUI();
  }

  _initUI() {
    document.getElementById('btnUnlock').addEventListener('click', () => this._checkCode());
    document.getElementById('btnClose').addEventListener('click',  () => this.close());
    document.getElementById('btnNoteClose').addEventListener('click', () => this.close());

    this.$digits.forEach((inp, i) => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { this._checkCode(); return; }
        if (e.key === 'Backspace' && !inp.value && i > 0) {
          this.$digits[i-1].focus(); this.$digits[i-1].value = '';
        }
      });
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/[^0-9]/g,'');
        if (inp.value && i < 2) {
          this.snd?.playDigitBeep();
          this.$digits[i+1].focus();
        }
      });
    });
  }

  /* ================================
     ROOM 1
  ================================ */
  openLock() {
    if (this.solved) { this.showMessage('Already unlocked! The door is open.'); return; }
    this._showModal('lock');
    this.$digits.forEach(d => d.value = '');
    this.$error.textContent = '';
    this.$digits[0].focus();
  }

  openNote() {
    this._showModal('note');
    this._markObjective(1);
    this.$noteContent.innerHTML = `
      <strong>Secret Note</strong>
      The ancient wardens spoke of a code passed through the ages...<br><br>
      <span class="code-hint">"One &nbsp;-- &nbsp;Three &nbsp;-- &nbsp;Seven"</span><br><br>
      Find the <em>Code Lock</em> on the table and enter the sequence.<br>
      <span style="opacity:0.6;font-size:13px;">-- The Warden</span>
    `;
  }

  showMessage(text) {
    this._showModal('note');
    this.$noteContent.innerHTML = `<span style="font-size:15px;">${text}</span>`;
  }

  close() {
    this.$modal.classList.remove('open');
    this.$modal.style.display = 'none';
    setTimeout(() => {
      if (!document.getElementById('startScreen').style.display ||
          document.getElementById('startScreen').style.display === 'none') {
        document.getElementById('gameCanvas').requestPointerLock?.();
      }
    }, 80);
  }

  remoteSolve() {
    if (this.solved) return;
    this.solved = true;
    this.gs.openDoor();
    this._markObjective(2);
    this.showMessage('A teammate cracked the code! The door is open!');
  }

  /* ================================
     ROOM 2 -- Symbol puzzle
  ================================ */
  openSymbolRef() {
    const room = this.activeRoom;
    if (!room || !room._puzzleSymbols) return;
    this._showModal('note');
    const {answer, pressed} = room._puzzleSymbols;
    this.$noteContent.innerHTML = `
      <strong>Symbol Order</strong><br><br>
      Press the wall symbols in this exact order:<br><br>
      <span style="font-size:30px; letter-spacing:14px; color:#88aaff; display:block; text-align:center; margin:10px 0;">${answer.join('  ')}</span><br>
      ${room.symbolSolved
        ? '<span style="color:#44ff88; font-weight:bold;">Symbol puzzle solved!</span>'
        : `Progress: <b style="color:#aaccff;">${pressed.length} / 3 pressed</b>`}
      <br><br><span style="opacity:0.5;font-size:11px;">Find the matching symbols on the north wall and press them in order.</span>
    `;
  }

  pressSymbolPanel(sym, mesh) {
    const room = this.activeRoom;
    if (!room || room.symbolSolved) return;
    room.pressSymbol(sym, mesh, this.gs, this.snd);
    const n = room._puzzleSymbols.pressed.length;
    if (!room.symbolSolved) this._toast(`Symbol ${n}/3 pressed...`);
    else {
      this._markObjective(1);
      this._toast('Symbol puzzle solved!');
    }
  }

  /* ================================
     ROOM 2 -- Simon Says
  ================================ */
  startSimon() {
    const room = this.activeRoom;
    if (!room) return;
    if (room.simonSolved) { this._toast('Simon puzzle already complete!'); return; }
    if (room._simonState.phase !== 'idle') return;
    room.startSimon(this.gs, this.snd);
  }

  pressSimonPad(padIdx) {
    const room = this.activeRoom;
    if (!room || room.simonSolved || room._simonState.phase !== 'input') return;
    room.pressSimon(padIdx, this.gs, this.snd);
    if (room.simonSolved) {
      this._markObjective(2);
      this._toast('Simon Says solved!');
    }
  }

  /* ================================
     ROOM 3 -- Fragment hunt
  ================================ */
  collectFragment(fragIdx) {
    const room = this.activeRoom;
    if (!room) return;
    const frag = room._fragments[fragIdx];
    if (!frag || frag.found) return;
    this.snd?.playPickup();
    room.collectFragment(fragIdx, this.gs);
    const newCount = room._fragmentsFound;
    const total    = room._fragments.length;
    this._toast(`Key fragment collected! (${newCount}/${total})`);
    if (newCount >= total) { this._markObjective(1); this._markObjective(2); }
  }

  /* ================================
     INTERNALS
  ================================ */
  _showModal(mode) {
    if (document.pointerLockElement) document.exitPointerLock();
    this.$modal.style.display = 'block';
    this.$modal.classList.add('open');
    this.$modal.style.animation = 'none';
    this.$modal.offsetHeight;
    this.$modal.style.animation = '';

    if (mode === 'lock') {
      this.$title.textContent         = 'CODE LOCK';
      this.$noteContent.style.display = 'none';
      this.$lockUI.style.display      = 'block';
      this.$noteClose.style.display   = 'none';
    } else {
      this.$title.textContent         = 'NOTE';
      this.$noteContent.style.display = 'block';
      this.$lockUI.style.display      = 'none';
      this.$noteClose.style.display   = 'block';
    }
  }

  _toast(msg) {
    let t = document.getElementById('pzToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pzToast';
      Object.assign(t.style, {
        position:'fixed', bottom:'82px', left:'50%',
        transform:'translateX(-50%)',
        background:'rgba(20,8,0,0.88)',
        color:'#ffcc66', fontFamily:"'Courier New', monospace",
        fontSize:'13px', padding:'7px 20px',
        borderRadius:'20px', zIndex:'250',
        border:'1px solid rgba(255,180,60,0.3)',
        pointerEvents:'none', transition:'opacity 0.4s',
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.style.opacity = '0', 2600);
  }

  _checkCode() {
    const entered = this.$digits.map(d => d.value).join('');
    if (entered.length < 3) { this._flashError('Enter all 3 digits!'); return; }
    if (entered === this.SECRET) {
      this.snd?.playSuccess();
      this._onSolve();
    } else {
      this.snd?.playError();
      this._flashError('Wrong code. Try again.');
      this.$digits.forEach(d => {
        d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
        setTimeout(() => d.classList.remove('shake'), 350);
        d.value = '';
      });
      this.$digits[0].focus();
    }
  }

  _onSolve() {
    this.solved = true;
    this.close();
    this.gs.openDoor();
    this.snd?.playDoorOpen();
    this._markObjective(2);
    if (this.onSolved) this.onSolved();
    setTimeout(() => this.showMessage('CLICK! The door is open! Head to the exit!'), 1600);
  }

  _markObjective(n) {
    const el = document.getElementById(`obj${n}`);
    if (el && !el.classList.contains('done')) {
      el.classList.add('done');
      const sp = el.querySelector('.obj-pending,.obj-check');
      if (sp) { sp.className='obj-check'; sp.textContent='✓'; }
    }
  }

  _flashError(msg) {
    this.$error.textContent = msg;
    setTimeout(() => this.$error.textContent = '', 2400);
  }

  getElapsed() {
    const s = Math.floor((Date.now()-this._startTime)/1000);
    return `${Math.floor(s/60)}m ${s%60}s`;
  }
}
