// sound.js -- Web Audio API sound manager, all sounds procedurally generated
export class SoundManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
    this._masterGain = null;
    this._init();
  }

  _init() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 0.55;
      this._masterGain.connect(this._ctx.destination);
    } catch(e) {
      console.warn('[Sound] Web Audio not available');
      this._enabled = false;
    }
  }

  // Resume context after user gesture (required by browsers)
  resume() {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  _ctx_time() { return this._ctx ? this._ctx.currentTime : 0; }

  // -- Low-level helpers --
  _osc(type, freq, startTime, duration, gainVal=0.3, endFreq=null) {
    if (!this._enabled || !this._ctx) return;
    const g = this._ctx.createGain();
    g.connect(this._masterGain);
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    const osc = this._ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
    osc.connect(g);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  _noise(startTime, duration, gainVal=0.15, filterFreq=800) {
    if (!this._enabled || !this._ctx) return;
    const bufSize = this._ctx.sampleRate * duration;
    const buf = this._ctx.createBuffer(1, bufSize, this._ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this._ctx.createBufferSource();
    src.buffer = buf;

    const filter = this._ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    const g = this._ctx.createGain();
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this._masterGain);
    src.start(startTime);
    src.stop(startTime + duration);
  }

  // ==============================
  //  GAME SOUNDS
  // ==============================

  // Door unlocking / creaking open
  playDoorOpen() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    // Low creak
    this._osc('sawtooth', 80, t, 0.3, 0.18, 55);
    this._osc('sawtooth', 120, t+0.1, 0.4, 0.12, 75);
    this._noise(t, 0.5, 0.08, 200);
    // Mechanical clunk
    this._osc('square', 60, t+0.05, 0.15, 0.25, 40);
    // Success chime
    this._osc('sine', 440, t+0.5, 0.3, 0.15);
    this._osc('sine', 550, t+0.65, 0.3, 0.12);
    this._osc('sine', 660, t+0.8, 0.4, 0.10);
  }

  // Footstep (call periodically while moving)
  playFootstep() {
    if (!this._enabled || !this._ctx) return;
    const t = this._ctx_time();
    this._noise(t, 0.07, 0.06, 300 + Math.random()*200);
    this._osc('sine', 55 + Math.random()*20, t, 0.08, 0.04);
  }

  // Picking up / collecting an item
  playPickup() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    this._osc('sine', 660, t,      0.12, 0.2);
    this._osc('sine', 880, t+0.08, 0.12, 0.18);
    this._osc('sine', 1100,t+0.16, 0.18, 0.15);
    this._osc('triangle', 1320, t+0.22, 0.25, 0.10);
  }

  // Code lock digit entry
  playDigitBeep() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    this._osc('square', 880, t, 0.07, 0.08);
    this._osc('sine', 1100, t+0.04, 0.06, 0.06);
  }

  // Wrong code / puzzle fail
  playError() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    this._osc('sawtooth', 200, t,      0.15, 0.2, 140);
    this._osc('sawtooth', 180, t+0.12, 0.15, 0.2, 120);
    this._noise(t, 0.3, 0.06, 400);
  }

  // Puzzle solved / success
  playSuccess() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    const notes = [523, 659, 784, 1047]; // C E G C (major arpeggio)
    notes.forEach((freq, i) => {
      this._osc('sine', freq, t + i*0.12, 0.35, 0.18);
      this._osc('triangle', freq*2, t + i*0.12, 0.2, 0.06);
    });
  }

  // Symbol panel press (distinctive click)
  playSymbolPress() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    this._osc('square', 440, t, 0.06, 0.15);
    this._osc('sine', 660, t+0.03, 0.08, 0.10);
  }

  // Symbol wrong sequence
  playSymbolWrong() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    this._osc('sawtooth', 220, t, 0.2, 0.18, 160);
    this._osc('sawtooth', 200, t+0.1, 0.2, 0.15, 140);
  }

  // Simon Says pad flash (each color has different pitch)
  playSimonPad(padIdx) {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const freqs = [330, 415, 494, 622]; // E Ab B Eb
    const t = this._ctx_time();
    this._osc('sine', freqs[padIdx], t, 0.35, 0.22);
    this._osc('triangle', freqs[padIdx]*2, t, 0.25, 0.08);
  }

  // Simon wrong input
  playSimonWrong() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    this._osc('sawtooth', 180, t, 0.4, 0.2, 100);
    this._noise(t, 0.4, 0.08, 300);
  }

  // Simon complete
  playSimonComplete() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    [392, 494, 587, 784].forEach((freq, i) => {
      this._osc('sine', freq, t + i*0.1, 0.3, 0.18);
    });
  }

  // Room transition whoosh
  playRoomTransition() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    this._noise(t, 1.2, 0.2, 600);
    this._osc('sine', 80, t, 1.0, 0.15, 40);
    this._osc('sine', 200, t+0.3, 0.7, 0.10, 80);
  }

  // Final win fanfare
  playWin() {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    const t = this._ctx_time();
    const melody = [523,659,784,1047,784,1047,1319];
    melody.forEach((freq, i) => {
      this._osc('sine',     freq,   t + i*0.18, 0.5, 0.18);
      this._osc('triangle', freq*2, t + i*0.18, 0.3, 0.06);
    });
    // Bass
    [130,165,196,262].forEach((freq, i) => {
      this._osc('sawtooth', freq, t + i*0.36, 0.7, 0.08);
    });
  }

  // Ambient hum (call once, loops)
  startAmbientHum(roomNum) {
    if (!this._enabled || !this._ctx) return;
    this.resume();
    if (this._ambientOsc) {
      try { this._ambientOsc.stop(); } catch(e){}
    }
    const freqMap = { 1: 55, 2: 45, 3: 40 };
    const freq = freqMap[roomNum] || 55;
    const osc = this._ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = this._ctx.createGain();
    g.gain.value = 0.04;
    osc.connect(g);
    g.connect(this._masterGain);
    osc.start();
    this._ambientOsc = osc;
    this._ambientGain = g;
  }

  stopAmbientHum() {
    if (this._ambientOsc) {
      try {
        this._ambientGain.gain.exponentialRampToValueAtTime(0.0001, this._ctx.currentTime + 0.5);
        this._ambientOsc.stop(this._ctx.currentTime + 0.6);
      } catch(e){}
      this._ambientOsc = null;
    }
  }
}
