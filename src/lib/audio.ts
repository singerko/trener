let audioContext: AudioContext | null = null;

const getAudioContext = () => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioContextClass();
    }

    return audioContext;
};

export const playTone = (freq: number = 440, type: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'sine', duration: number = 0.1, volume: number = 0.8) => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, ctx.currentTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        const startTone = () => {
            const startAt = ctx.currentTime;
            osc.start(startAt);
            gain.gain.exponentialRampToValueAtTime(0.00001, startAt + duration);
            osc.stop(startAt + duration);
        };

        if (ctx.state === 'suspended') {
            ctx.resume().then(startTone).catch(() => startTone());
        } else {
            startTone();
        }
    } catch (e) {
        console.error("Audio Playback Error", e);
    }
};

export const playSoundEffect = (effect: 'START' | 'FINISH' | 'BEEP' | 'TICK') => {
    switch (effect) {
        case 'START':
            playTone(600, 'sine', 0.1);
            setTimeout(() => playTone(800, 'sine', 0.2), 100);
            break;
        case 'FINISH':
            playTone(500, 'sine', 0.1);
            setTimeout(() => playTone(600, 'sine', 0.1), 100);
            setTimeout(() => playTone(800, 'square', 0.4), 200);
            break;
        case 'BEEP':
            playTone(880, 'square', 0.15);
            break;
        case 'TICK':
            playTone(1200, 'square', 0.12, 1);
            break;
    }
};

export const primeAudioOutput = () => {
    playTone(440, 'sine', 0.03, 0.001);
};
