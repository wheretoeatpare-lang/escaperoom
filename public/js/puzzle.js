// puzzle.js — Code-lock puzzle system + modal UI management
export class Puzzle {
  constructor(gameScene) {
    this.gs      = gameScene;
    this.solved  = false;
    this.SECRET  = '137';

    // Timer
    this._startTime = Date.now();

    // DOM refs
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

    // External callbacks
    this.onSolved = null; // called when puzzle is first solved

    this._initUI();
  }

  /* ── UI Setup ───────────────────────────── */
  _initUI() {
    document.getElementById('btnUnlock').addEventListener('click', () => this._checkCode());
    document.getElementById('btnClose').addEventListener('click', () => this.close());
    document.getElementById('btnNoteClose').addEventListener('click', () => this.close());

    this.$digits.forEach((inp, i) => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { this._checkCode(); return; }
        // Backspace: clear + move back
        if (e.key === 'Backspace' && !inp.value && i > 0) {
          this.$digits[i-1].focus();
          this.$digits[i-1].value = '';
        }
      });
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/[^0-9]/g,'');
        if (inp.value && i < 2) this.$digits[i+1].focus();
      });
    });
  }

  /* ── Open code lock modal ───────────────── */
  openLock() {
    if (this.solved) {
      this.showMessage('✅ Already unlocked! The door is open.');
      return;
    }
    this._showModal('lock');
    this.$digits.forEach(d => d.value = '');
    this.$error.textContent = '';
    this.$digits[0].focus();
  }

  /* ── Open note modal ────────────────────── */
  openNote() {
    this._showModal('note');

    // Mark objective 1 done
    const obj1 = document.getElementById('obj1');
    if (obj1 && !obj1.classList.contains('done')) {
      obj1.classList.add('done');
      obj1.querySelector('.obj-pending,.obj-check').className = 'obj-check';
      obj1.querySelector('.obj-check').textContent = '✓';
    }

    this.$noteContent.innerHTML = `
      <strong>✦ Secret Note ✦</strong>
      The ancient wardens spoke of a code passed through the ages...<br><br>
      <span class="code-hint">"One &nbsp;—&nbsp; Three &nbsp;—&nbsp; Seven"</span><br><br>
      Find the <em>Code Lock</em> on the table and enter the sequence.<br>
      <span style="opacity:0.6;font-size:13px;">— The Warden</span>
    `;
  }

  /* ── Show generic message ───────────────── */
  showMessage(text) {
    this._showModal('note');
    this.$noteContent.innerHTML = `<span style="font-size:15px;">${text}</span>`;
  }

  /* ── Close modal ────────────────────────── */
  close() {
    this.$modal.classList.remove('open');
    this.$modal.style.display = 'none';

    // Re-lock pointer if game is running
    setTimeout(() => {
      if (!document.getElementById('startScreen').style.display ||
          document.getElementById('startScreen').style.display === 'none') {
        document.getElementById('gameCanvas').requestPointerLock?.();
      }
    }, 80);
  }

  /* ── Called from network (another player solved) ── */
  remoteSolve() {
    if (this.solved) return;
    this.solved = true;
    this.gs.openDoor();
    this._markObjective2();
    this.showMessage('🎉 A teammate cracked the code! The door is open!');
  }

  /* ── Internals ──────────────────────────── */
  _showModal(mode) {
    // Unlock pointer first
    if (document.pointerLockElement) document.exitPointerLock();

    this.$modal.style.display = 'block';
    this.$modal.classList.add('open');
    // Force re-trigger animation
    this.$modal.style.animation = 'none';
    this.$modal.offsetHeight; // reflow
    this.$modal.style.animation = '';

    if (mode === 'lock') {
      this.$title.textContent      = '🔒 CODE LOCK';
      this.$noteContent.style.display = 'none';
      this.$lockUI.style.display   = 'block';
      this.$noteClose.style.display= 'none';
    } else {
      this.$title.textContent      = '📜 NOTE';
      this.$noteContent.style.display = 'block';
      this.$lockUI.style.display   = 'none';
      this.$noteClose.style.display= 'block';
    }
  }

  _checkCode() {
    const entered = this.$digits.map(d => d.value).join('');
    if (entered.length < 3) {
      this._flashError('Enter all 3 digits!');
      return;
    }

    if (entered === this.SECRET) {
      this._onSolve();
    } else {
      this._flashError('✗ Wrong code. Try again.');
      this.$digits.forEach(d => {
        d.classList.remove('shake');
        void d.offsetWidth; // reflow
        d.classList.add('shake');
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
    this._markObjective2();

    if (this.onSolved) this.onSolved();

    // Show door-open notification (briefly)
    setTimeout(() => {
      this.showMessage('🔓 CLICK! The door is open! Head to the exit!');
    }, 1600);
  }

  _markObjective2() {
    const obj2 = document.getElementById('obj2');
    if (obj2 && !obj2.classList.contains('done')) {
      obj2.classList.add('done');
      const sp = obj2.querySelector('.obj-pending,.obj-check');
      if (sp) { sp.className='obj-check'; sp.textContent='✓'; }
    }
  }

  _flashError(msg) {
    this.$error.textContent = msg;
    setTimeout(() => { this.$error.textContent=''; }, 2400);
  }

  getElapsed() {
    const s = Math.floor((Date.now() - this._startTime)/1000);
    const m = Math.floor(s/60);
    return `${m}m ${s%60}s`;
  }
}
