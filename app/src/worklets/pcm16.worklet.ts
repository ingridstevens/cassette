// Runs on the audio thread, so a busy window (dragging, scrolling a long transcript) cannot drop audio.
// Collects 4096 samples at a time as 16-bit PCM and posts them with the loudest sample seen.
declare const registerProcessor: (name: string, ctor: unknown) => void;
declare class AudioWorkletProcessor { port: MessagePort }

class Pcm16 extends AudioWorkletProcessor {
  buf = new Int16Array(4096); n = 0; peak = 0;
  process(inputs: Float32Array[][]) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const v = Math.max(-1, Math.min(1, ch[i]));
      this.peak = Math.max(this.peak, Math.abs(v));
      this.buf[this.n++] = v < 0 ? v * 32768 : v * 32767;
      if (this.n === this.buf.length) {
        this.port.postMessage({ pcm: this.buf.buffer, peak: this.peak }, [this.buf.buffer]);
        this.buf = new Int16Array(4096); this.n = 0; this.peak = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm16", Pcm16);
