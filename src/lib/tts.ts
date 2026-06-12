import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

type QueueItem = {
    text: string;
    lang: string;
    resolve: () => void;
    reject: (e: unknown) => void;
};

let isSpeaking = false;
let activeItem: QueueItem | null = null;
let activeWebUtterance: SpeechSynthesisUtterance | null = null;
let webSpeechUnlocked = false;
let webSpeechUnlockAttempted = false;
const queue: QueueItem[] = [];

const isNativeTts = () => Capacitor.isNativePlatform();

const getSpeechSynthesis = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return null;
    }

    return window.speechSynthesis;
};

const getSpeechSynthesisUtterance = () => {
    if (typeof window === 'undefined' || !('SpeechSynthesisUtterance' in window)) {
        return null;
    }

    return window.SpeechSynthesisUtterance;
};

const primeWebSpeech = () => {
    if (webSpeechUnlocked || webSpeechUnlockAttempted || isNativeTts()) return;

    const synthesis = getSpeechSynthesis();
    const Utterance = getSpeechSynthesisUtterance();
    if (!synthesis || !Utterance) return;

    webSpeechUnlockAttempted = true;

    try {
        const utterance = new Utterance(' ');
        utterance.lang = 'sk-SK';
        utterance.volume = 0.01;
        utterance.onend = () => {
            webSpeechUnlocked = true;
        };
        utterance.onerror = () => {
            webSpeechUnlockAttempted = false;
        };

        synthesis.cancel();
        synthesis.speak(utterance);
    } catch (e) {
        webSpeechUnlockAttempted = false;
        console.warn('Web TTS unlock failed:', e);
    }
};

if (typeof window !== 'undefined') {
    const events: Array<keyof WindowEventMap> = ['pointerup', 'touchend', 'click'];
    events.forEach(eventName => {
        window.addEventListener(eventName, primeWebSpeech, { passive: true });
    });
}

const speakOnWeb = (text: string, lang: string) => {
    const synthesis = getSpeechSynthesis();
    const Utterance = getSpeechSynthesisUtterance();
    if (!synthesis || !Utterance) {
        return Promise.reject(new Error('Web Speech API is not available'));
    }

    return new Promise<void>((resolve, reject) => {
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const utterance = new Utterance(text);
        utterance.lang = lang;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        const finish = () => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (activeWebUtterance === utterance) {
                activeWebUtterance = null;
            }
            resolve();
        };

        const fail = (event: SpeechSynthesisErrorEvent) => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (activeWebUtterance === utterance) {
                activeWebUtterance = null;
            }
            reject(event);
        };

        utterance.onstart = () => {
            webSpeechUnlocked = true;
        };
        utterance.onend = finish;
        utterance.onerror = fail;

        if (synthesis.paused) {
            synthesis.resume();
        }

        activeWebUtterance = utterance;
        synthesis.speak(utterance);

        // iOS Safari can occasionally miss onend. Keep the workout queue moving.
        const estimatedMs = Math.max(2000, text.length * 120 + 1500);
        timeoutId = setTimeout(finish, estimatedMs);
    });
};

const speakOnNative = (text: string, lang: string) => TextToSpeech.speak({
    text,
    lang,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    category: 'ambient',
});

const processQueue = async () => {
    if (isSpeaking || queue.length === 0) return;

    const current = queue.shift();
    if (!current) return;

    isSpeaking = true;
    activeItem = current;

    try {
        if (isNativeTts()) {
            await speakOnNative(current.text, current.lang);
        } else {
            await speakOnWeb(current.text, current.lang);
        }
        current.resolve();
    } catch (e) {
        console.error('TTS Error:', e);
        current.reject(e);
    } finally {
        if (activeItem === current) {
            activeItem = null;
        }
        isSpeaking = false;
        processQueue();
    }
};

export const speak = async (
    text: string,
    lang: string = 'sk-SK',
    options: { interrupt?: boolean } = {},
): Promise<void> => {
    if (!text.trim()) return;

    if (options.interrupt) {
        await stopSpeech();
    }

    return new Promise((resolve, reject) => {
        queue.push({ text, lang, resolve, reject });
        processQueue();
    });
};

export const stopSpeech = async () => {
    const queued = queue.splice(0);
    queued.forEach(item => item.resolve());

    if (activeItem) {
        activeItem.resolve();
        activeItem = null;
    }

    try {
        if (isNativeTts()) {
            await TextToSpeech.stop();
        } else {
            getSpeechSynthesis()?.cancel();
            activeWebUtterance = null;
        }
    } catch (e) {
        console.error('TTS Stop Error', e);
    } finally {
        isSpeaking = false;
    }
};
