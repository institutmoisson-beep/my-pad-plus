let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** Short two-note premium chime used for messages, payments and alerts. */
export function playChime(kind: "message" | "success" | "alert" = "message") {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  const notes =
    kind === "success" ? [660, 880, 1320] : kind === "alert" ? [520, 400] : [880, 1174];
  notes.forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = audio.currentTime + i * 0.11;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
}