import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

// --- TEXT TO SPEECH SERVICE (Služba na Rozprávanie) ---
// Úloha: Postarať sa o to, aby vety boli povedané pekne za sebou (Fronta/Queue).
// Ak by sme len zavolali speak() 3x za sebou, Native vrstva by buď sekla prvú vetu, alebo ignorovala ostatné.

let isSpeaking = false; // Flag: Rozprávam práve teraz?

// Fronta príkazov.
// Každá položka obsahuje nielen text, ale aj funkcie 'resolve' a 'reject'.
// To nám umožňuje spojiť "požiadavku" (vyslov toto) s "výsledkom" (dohovoril som) cez Promise.
const queue: { text: string; lang: string; resolve: () => void; reject: (e: any) => void }[] = [];

const processQueue = async () => {
    // Ak už rozprávam, alebo je fronta prázdna, nerob nič.
    if (isSpeaking || queue.length === 0) return;

    const current = queue.shift();
    if (!current) return;

    isSpeaking = true; // Zdvihneme vlajku
    try {
        // Voláme Capacitor Plugin (Android Native TTS)
        await TextToSpeech.speak({
            text: current.text,
            lang: current.lang,
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            category: 'ambient',
        });

        // --- ÚSPECH ---
        // Tu sa stane mágia. Zavolaním 'resolve()' hovoríme kódu, ktorý čaká na 'await speak(...)',
        // že môže pokračovať ďalej. Je to ako "Callback", ale zabalený do Promise.
        current.resolve();
    } catch (e) {
        console.error('TTS Error:', e);
        if (!Capacitor.isNativePlatform()) {
            // Web Fallback (pre testovanie v prehliadači)
            // Prehliadače majú vlastné API: window.speechSynthesis
            try {
                const utterance = new SpeechSynthesisUtterance(current.text);
                utterance.lang = current.lang;

                // Web API nepodporuje priamo Promise, tak ho musíme "obaliť".
                await new Promise<void>((resolve, reject) => {
                    utterance.onend = () => resolve(); // Keď dohovorí -> resolve
                    utterance.onerror = (err) => reject(err);
                    window.speechSynthesis.speak(utterance);
                });
                current.resolve();
            } catch (webErr) {
                console.error("Web TTS failed", webErr);
                current.reject(webErr);
            }
        } else {
            // Ak zlyhá Native, vrátime chybu
            current.reject(e);
        }
    } finally {
        isSpeaking = false; // Zložíme vlajku
        processQueue(); // Rekurzívne skúsime spracovať ďalšiu položku
    }
};

/**
 * Hlavná funkcia pre vonkajší svet.
 * Všimni si, že vracia 'Promise<void>'.
 * To znamená, že volajúci môže napísať: 'await speak("Ahoj")' a kód počká, kým to naozaj dohovorí.
 */
export const speak = async (text: string, lang: string = 'sk-SK', options: { interrupt?: boolean } = {}): Promise<void> => {
    if (options.interrupt) {
        await stopSpeech();
    }

    return new Promise((resolve, reject) => {
        // Namiesto toho, aby sme rovno volali plugin, len pridáme požiadavku do fronty.
        // Odovzdávame 'resolve' a 'reject' funkcie, aby ich 'processQueue' mohol zavolať neskôr.
        queue.push({ text, lang, resolve, reject });

        // Spustíme spracovanie fronty (ak nebeží)
        processQueue();
    });
};

export const stopSpeech = async () => {
    const queued = queue.splice(0);
    queued.forEach(item => item.resolve());
    try {
        await TextToSpeech.stop();
        if (!Capacitor.isNativePlatform()) {
            window.speechSynthesis.cancel();
        }
    } catch (e) {
        console.error('TTS Stop Error', e);
    }
    isSpeaking = false;
}
