let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  frequencies: number[],
  durations: number[],
  type: OscillatorType = 'sine',
  volume = 0.3,
  repeats = 1,
) {
  try {
    const ctx = getAudioContext();
    let startTime = ctx.currentTime;

    for (let r = 0; r < repeats; r++) {
      for (let i = 0; i < frequencies.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequencies[i];
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + durations[i]);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + durations[i]);
        startTime += durations[i];
      }
      if (r < repeats - 1) {
        startTime += 0.15;
      }
    }
  } catch {
    // Audio not supported
  }
}

export function playSosAlert() {
  playTone(
    [880, 660, 880, 660, 880, 660],
    [0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
    'square',
    0.4,
    2,
  );
}

export function playIncidentAlert() {
  playTone(
    [523, 659, 784],
    [0.2, 0.2, 0.35],
    'triangle',
    0.35,
    2,
  );
}

export function playMessageAlert() {
  playTone(
    [587, 784],
    [0.1, 0.18],
    'sine',
    0.25,
    1,
  );
}

export function playNotificationAlert() {
  playTone(
    [698],
    [0.22],
    'sine',
    0.2,
    1,
  );
}
