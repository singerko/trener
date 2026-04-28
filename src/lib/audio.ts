export const playTone = (freq: number = 440, type: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'sine', duration: number = 0.1) => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
        osc.stop(ctx.currentTime + duration);
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
            playTone(1000, 'sine', 0.05);
            break;
    }
};
