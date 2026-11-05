// Synthesized stairwell audio: ambient hum, echoing footsteps, door creaks. No audio files needed.

export class StairAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private reverbIn!: GainNode;
  private noise!: AudioBuffer;
  private muted = false;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    // Noise buffer (2s)
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Concrete reverb: long decaying stereo noise impulse
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = 0.55;
    this.reverbIn.connect(conv).connect(this.master);

    this.startAmbient();
  }

  get enabled() {
    return !this.muted;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  private startAmbient() {
    const ctx = this.ctx!;
    // Brown-ish rumble
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.06;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();
    // Electrical hum from the lamp
    for (const [f, v] of [
      [50, 0.018],
      [100, 0.01],
      [150, 0.004],
    ] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = v;
      o.connect(og).connect(this.master);
      o.start();
    }
  }

  private hit(time: number, gain: number, pitch: number, pan: number, wet: number) {
    const ctx = this.ctx!;
    const out = ctx.createStereoPanner();
    out.pan.value = pan;
    const dry = ctx.createGain();
    dry.gain.value = 1 - wet * 0.6;
    const send = ctx.createGain();
    send.gain.value = wet;
    out.connect(dry).connect(this.master);
    out.connect(send).connect(this.reverbIn);

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(1600 * pitch, time);
    bp.frequency.exponentialRampToValueAtTime(260 * pitch, time + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.8 * gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    src.connect(bp).connect(g).connect(out);
    src.start(time, Math.random() * 1.5, 0.2);

    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(120 * pitch, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.11);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, time);
    og.gain.exponentialRampToValueAtTime(0.75 * gain, time + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    o.connect(og).connect(out);
    o.start(time);
    o.stop(time + 0.2);
  }

  /** Your own footstep. */
  step() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const p = 0.95 + Math.random() * 0.1;
    this.hit(t, 0.9, p, (Math.random() - 0.5) * 0.2, 0.35);
    this.hit(t + 0.055, 0.35, p * 1.2, 0, 0.3);
  }

  /** Someone else's footstep, a beat behind yours. */
  follower(delay = 0.34) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const p = 0.82 + Math.random() * 0.06;
    const pan = Math.random() < 0.5 ? -0.45 : 0.45;
    this.hit(t, 0.55, p, pan, 0.75);
    this.hit(t + 0.06, 0.2, p * 1.15, pan, 0.75);
  }

  creak(duration = 1.1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(230, t + duration * 0.6);
    o.frequency.linearRampToValueAtTime(170, t + duration);
    const wob = ctx.createOscillator();
    wob.frequency.value = 23;
    const wobG = ctx.createGain();
    wobG.gain.value = 18;
    wob.connect(wobG).connect(o.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(bp).connect(g);
    g.connect(this.master);
    g.connect(this.reverbIn);
    o.start(t);
    wob.start(t);
    o.stop(t + duration + 0.05);
    wob.stop(t + duration + 0.05);
    // latch clunk
    this.hit(t, 0.5, 0.6, 0.1, 0.6);
  }

  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1200, t + 0.45);
    bp.frequency.exponentialRampToValueAtTime(200, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, 0, 1);
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
