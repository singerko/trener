import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Vosk } from 'vosk-speech-recognition-capacitor';

// Web Speech API Types (minimal)
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export type VoiceCommand = 'NEXT' | 'START' | 'PAUSE' | 'REP' | 'UNKNOWN';

export const useVoiceControl = (enabled: boolean, lang: string = 'sk-SK', engine: 'NATIVE' | 'WEB' | 'VOSK' = 'VOSK', onCommand: (cmd: VoiceCommand) => void) => {
    const [isListening, setIsListening] = useState(false);
    const [lastTranscript, setLastTranscript] = useState('');
    const [error, setError] = useState('');
    const recognitionRef = useRef<any>(null);
    const voskPartialHandleRef = useRef<any>(null);
    const voskResultHandleRef = useRef<any>(null);
    const lastTranscriptUpdateRef = useRef(0);
    const isNative = Capacitor.isNativePlatform();
    const [isPageVisible, setIsPageVisible] = useState(() => {
        if (typeof document === 'undefined') return true;
        return !document.hidden;
    });
    const shouldListen = enabled && isPageVisible;

    useEffect(() => {
        const handleVisibilityChange = () => setIsPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Command Parsing
    const processTranscript = useCallback((transcript: string, confidence: number = 1.0) => {
        const t = transcript.trim().toLowerCase();

        // Debug info
        const now = Date.now();
        if (now - lastTranscriptUpdateRef.current > 300) {
            const debugText = confidence < 1.0 ? `${t} (${confidence.toFixed(2)})` : t;
            setLastTranscript(debugText);
            lastTranscriptUpdateRef.current = now;
        }

        // Confidence Threshold (only applies if confidence was actually measured, i.e. final result)
        // Adjust threshold as needed. 0.6 is a safe start.
        if (confidence < 0.6) {
            console.log("Ignored Low Confidence:", t, confidence);
            return;
        }

        const words = t.split(/[\s,.!?]+/); // Tokenize by whitespace/punctuation

        // 1. Navigation Commands
        // Check for EXACT word matches
        if (words.includes('štart') || words.includes('start') || words.includes('spusti')) {
            onCommand('START');
            return;
        }

        // "Stop" triggers NEXT (Finish Set)
        if (words.includes('stop') || words.includes('hotovo') || words.includes('ďalej') || words.includes('dalej')) {
            onCommand('NEXT');
            return;
        }

        if (words.includes('pauza')) {
            onCommand('PAUSE');
            return;
        }

        const repWords = ['jeden', 'raz', 'dva', 'tri', 'štyri', 'styri', 'päť', 'pat', 'šesť', 'sest', 'sedem', 'osem', 'deväť', 'devat', 'desať', 'desat'];
        if (words.some(word => repWords.includes(word)) || words.some(word => /^\d+$/.test(word))) {
            onCommand('REP');
        }
    }, [onCommand]);

    useEffect(() => {
        let isActive = true;
        let webRestartTimeout: any = null;
        let safetyTimeout: any = null;
        let nativeRestartTimeout: any = null;

        const stopNative = async () => {
            try {
                await SpeechRecognition.stop();
                await SpeechRecognition.removeAllListeners();
            } catch { }
        };

        const startNative = async () => {
            // CRITICAL: Always correct Zombie states by stopping first!
            // This mimics the "Language Switch" fix.
            await stopNative();

            try {
                // 1. Availability check
                const available = await SpeechRecognition.available();
                if (!available) {
                    if (isActive) setError("Native: Services Unavailable");
                    return;
                }

                // 2. Permissions
                const { speechRecognition } = await SpeechRecognition.requestPermissions();
                if (speechRecognition !== 'granted') {
                    if (isActive) setError("Native: Perms Denied");
                    return;
                }

                if (!isActive) return;

                // 3. Setup Listeners (CRITICAL!)
                // Note: stopNative() already removed them, but we add fresh ones here.

                // Partial Results (The actual text)
                await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
                    if (data.matches && data.matches.length > 0) {
                        processTranscript(data.matches[0]);
                    }
                });

                // Lifecycle Monitor (Auto-Restart)
                await SpeechRecognition.addListener('listeningState', (data: { status: "started" | "stopped" }) => {
                    if (data.status === 'started') {
                        setIsListening(true);
                        setError("");
                    } else if (data.status === 'stopped') {
                        setIsListening(false);
                        // If we are supposed to be active, RESTART!
                        if (isActive && shouldListen) {
                            // Wait a bit to avoid "Machine Gun" beeps if it dies instantly
                            nativeRestartTimeout = setTimeout(() => {
                                if (isActive && shouldListen) startNative();
                            }, 1500);
                        }
                    }
                });

                // 4. Start
                const opts: any = {
                    maxResults: 2,
                    prompt: "",
                    partialResults: true,
                    popup: false,
                    continuous: true, // Try to keep session alive!
                };
                if (lang && lang !== 'default') {
                    opts.language = lang;
                }

                await SpeechRecognition.start(opts);

                if (isActive) {
                    setIsListening(true);
                    setError("");
                }

            } catch (e: any) {
                // Ignore "Client busy" or "RecognitionService busy" errors - this means it's working!
                const msg = e.message || e.toString();
                if (msg.includes('busy') || msg.includes('Busy')) {
                    if (isActive) {
                        setIsListening(true);
                        setError("");
                    }
                    return;
                }

                console.error("Native Voice Error:", e);
                if (isActive) {
                    // Only show real errors
                    if (msg.includes('error') || msg.includes('Client')) {
                        // Keep silent for common retryable errors in loop?
                        // setError("Chyba: Skontroluj Jazyk!");
                    } else {
                        // setError(msg);
                    }
                }
            }
        };


        // --- VOSK IMPLEMENTATION (Offline Engine) ---
        // Vysvetlenie pre programátora:
        // Toto je funkcia, ktorá komunikuje s "Natívnou Vrstvou" (Android Java/Kotlin kód).
        // React (Javascript) tu posiela príkazy cez "Bridge" (Capacitor plugin).
        const startVosk = async () => {
            try {
                await stopVosk();

                // 1. Load Model (Načítanie neurónovej siete)
                // 'await' kľúčové slovo znamená: "Zastav vykonávanie prúdu, kým táto asynchrónna operácia neskončí".
                // Je to ako 'blocking I/O' v Perli, ale bez zamrznutia UI vlákna.
                await (Vosk as any).loadModel({ modelName: 'vosk-model-cs' });

                // 2. Grammar (Slovník/Gramatika)
                // Definujeme zoznam slov, ktoré chceme rozpoznávať.
                // Funguje to ako prísny filter (Whitelist). čokoľvek mimo tento zoznam bude ignorované alebo priradené k najbližšiemu zvuku.
                // Preto pridávame aj "Fillers" (výplňové slová), aby sme zachytili bežný šum a reč, 
                // a zabránili tomu, aby sa náhodný zvuk "upratal" (Force Aligned) do príkazu "Štart".

                const commands = [
                    '"štart"', '"start"', '"spusti"',
                    '"stop"', '"hotovo"', '"ďalej"', '"dalej"',
                    '"pauza"',
                    '"jeden"', '"raz"', '"dva"', '"tri"', '"štyri"', '"styri"', '"päť"', '"pat"',
                    '"šesť"', '"sest"', '"sedem"', '"osem"', '"deväť"', '"devat"', '"desať"', '"desat"'
                ];

                // "Killer Fillers" - Slová, ktoré slúžia ako "odpadkový kôš" pre rozpoznávač.
                // Ak povieš "Ahoj", Vosk to priradí sem, a my to v kóde budeme ignorovať.
                // Ak by sme to tu nemali, "Ahoj" by sa mohlo mylne rozpoznať ako "Aaa -> Raz".
                const fillers = [
                    '"ahoj"', '"čau"', '"dobrý"', '"deň"', '"nie"', '"áno"', '"ok"', '"dobre"',
                    '"teraz"', '"potom"', '"ešte"', '"už"', '"nič"', '"neviem"', '"možno"',
                    '"koniec"', '"konca"', '"konci"', // Dôležité: Aby sa TTS ("Koniec cvičenia") nespustilo samo.
                    '"tréning"', '"cvičenie"', '"rozcvička"', '"šport"', '"pohyb"', '"hudba"', '"zvuk"',
                    '"voda"', '"uterák"', '"mobil"', '"telefón"', '"pozor"', '"rýchlo"', '"pomaly"',
                    '"ako"', '"prečo"', '"kde"', '"kedy"', '"kto"', '"čo"', '"je"', '"to"', '"toto"',
                    '"hovorím"', '"píšem"', '"text"', '"slovo"', '"veta"',
                    '"super"', '"paráda"', '"výborne"', '"bomba"', '"poďme"', '"pome"',
                    '"jaj"', '"au"', '"fúha"', '"nevládzem"', '"bolí"', '"svalovica"',
                    '"a"', '"ale"', '"alebo"', '"aby"', '"ak"', '"asi"', '"až"', '"bez"', '"bude"',
                    '"bol"', '"bola"', '"bolo"', '"byť"', '"cez"', '"čas"', '"človek"', '"ďalší"',
                    '"dnes"', '"do"', '"jedenásť"', '"dvanásť"',
                    '"razancia"', '"razantne"', // Fix pre falošný "Raz"
                    '"film"', '"chcieť"', '"ísť"', '"ja"', '"jeho"', '"jej"', '"ich"', '"iný"',
                    '"každý"', '"kráľ"', '"ktorý"', '"ku"', '"lebo"', '"len"', '"mať"', '"medzi"',
                    '"miesto"', '"môcť"', '"môj"', '"na"', '"nad"', '"nám"', '"náš"', '"nech"',
                    '"niečo"', '"nový"', '"o"', '"od"', '"on"', '"ona"', '"oni"', '"ono"', '"po"',
                    '"pod"', '"podľa"', '"pokiaľ"', '"pre"', '"pred"', '"pri"', '"prvý"', '"rok"',
                    '"ruka"', '"s"', '"sa"', '"si"', '"skoro"', '"som"', '"sú"', '"svoj"',
                    '"tak"', '"taký"', '"tam"', '"ten"', '"tento"', '"tá"', '"toho"', '"tom"', '"tomuto"',
                    '"tu"', '"ty"', '"tvoj"', '"už"', '"v"', '"vám"', '"váš"', '"veci"', '"veď"',
                    '"veľa"', '"viac"', '"všetko"', '"vy"', '"z"', '"za"', '"zo"', '"že"', '"život"'
                ];

                // Posielame konfiguráciu do Androidu
                await (Vosk as any).start({ grammar: [...commands, ...fillers] });

                if (isActive) {
                    setIsListening(true);
                    setError("");
                }

                // 3. Event Listeners (Poslucháči Udalostí)
                // Namiesto "Polling" (doookola sa pýtať: "máš dáta?"), funguje toto na princípe "Callbackov".
                // Keď Android vrstva niečo má, zavolá túto funkciu.
                const handleVoskResult = (data: any) => {
                    const raw = data.partialResult || data.result;
                    if (!raw) return;

                    try {
                        const res = JSON.parse(raw); // JSON dekódovanie (ako decode_json v Perli)
                        const text = res.partial || res.text; // Získame text

                        // Extrakcia "Confidence Score" (Istota 0.0 - 1.0)
                        // Ak si je model istý na menej ako 60%, zahadzujeme to.
                        let confidence = 1.0;
                        if (res.result && res.result.length > 0) {
                            confidence = res.result[0].conf;
                        }

                        if (text) {
                            // Voláme hlavnú logiku spracovania (viď funkciu processTranscript)
                            processTranscript(text, confidence);
                        }
                    } catch (e) {
                        console.error("Vosk Parse Fail", e);
                    }
                };

                // Registrácia Listenerov
                // Ukladáme si návratové hodnoty (handles), aby sme ich vedeli neskôr zrušiť.
                const partialHandle = await (Vosk as any).addListener('onPartialResults', handleVoskResult);
                const resultHandle = await (Vosk as any).addListener('onResult', handleVoskResult);
                voskPartialHandleRef.current = partialHandle;
                voskResultHandleRef.current = resultHandle;

            } catch (e: any) {
                console.error("Vosk Error", e);
                if (isActive) setError("Vosk Error: " + e.message);
            }
        };

        const stopVosk = async () => {
            try {
                await (Vosk as any).stop();
                if (voskPartialHandleRef.current) {
                    await voskPartialHandleRef.current.remove();
                    voskPartialHandleRef.current = null;
                }
                if (voskResultHandleRef.current) {
                    await voskResultHandleRef.current.remove();
                    voskResultHandleRef.current = null;
                }
            } catch { }
            if (isActive) setIsListening(false);
        };

        // --- WEB IMPLEMENTATION ---
        const startWeb = () => {
            const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
            const SpeechRecognitionClass = SpeechRecognition || webkitSpeechRecognition;

            if (!SpeechRecognitionClass) {
                if (isActive) setError("Browser not supported");
                return;
            }

            // TROUBLESHOOTING: Force non-continuous on Mobile to prevent internal loops
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            const recognition = new SpeechRecognitionClass();
            recognition.continuous = !isMobile; // Only use continuous on Desktop
            recognition.interimResults = false;

            if (lang && lang !== 'default') {
                recognition.lang = lang;
            }

            // Track start time to detect rapid failures
            const startTimeRef = { current: Date.now() };

            recognition.onstart = () => {
                if (isActive) {
                    setIsListening(true);
                    setError('');
                    startTimeRef.current = Date.now();
                }
            };
            recognition.onresult = (event: any) => {
                if (!isActive) return;
                const lastResultIndex = event.results.length - 1;
                processTranscript(event.results[lastResultIndex][0].transcript);
            };

            let lastErrorDetail = '';
            let fatalError = false;

            recognition.onerror = (event: any) => {
                if (event.error === 'aborted' || event.error === 'no-speech') return;

                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    fatalError = true;
                }

                lastErrorDetail = event.error;
                if (isActive) setError(event.error);
            };

            recognition.onend = () => {
                if (!isActive) return;
                setIsListening(false);
                recognitionRef.current = null;

                if (fatalError) return;

                if (shouldListen) {
                    const duration = Date.now() - startTimeRef.current;

                    // CRITICAL FIX: If session was short (< 4s), it means improper termination or conflict.
                    // DO NOT RESTART AUTOMATICALLY. Stop the loop to prevent beeping.
                    if (duration < 4000) {
                        // Report specific cause if known
                        const cause = lastErrorDetail ? `(${lastErrorDetail})` : '(Silent Stop)';
                        setError(`Web Loop: ${cause}`);
                        return; // <--- EXIT LOOP
                    }

                    // Only restart if the session was healthy (> 4s)
                    webRestartTimeout = setTimeout(() => {
                        if (isActive && shouldListen) {
                            startWeb();
                        }
                    }, 500);
                }
            };

            recognitionRef.current = recognition;
            try {
                recognition.start();
            } catch {
                // If start fails immediately, retry later
                if (shouldListen && isActive) {
                    webRestartTimeout = setTimeout(startWeb, 2000);
                }
            }
        };

        if (shouldListen) {
            // Determine which engine to use
            if (engine === 'VOSK') {
                startVosk();
            } else if (engine === 'NATIVE' && isNative) {
                // Restore Native Logic (Continuous + Event Loop)
                // NO Polling (setInterval) to avoid constant beeping.

                // We rely on 'continuous: true' to keep it open.
                // If it ends, we restart it.
                startNative().catch(err => {
                    if (isActive) setError(err.message || 'Start failed');
                });
            } else {
                // WEB MODE: Add Silent Audio Context to prevent "Silent Stop"
                // This tricks Android into keeping the app high-priority for audio.
                try {
                    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContext) {
                        const ctx = new AudioContext();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();

                        osc.connect(gain);
                        gain.connect(ctx.destination);

                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(440, ctx.currentTime);
                        gain.gain.setValueAtTime(0.001, ctx.currentTime); // Almost silent, but active

                        osc.start();
                        (window as any)._silentAudioOsc = osc;
                        (window as any)._silentAudioCtx = ctx;
                    }
                } catch (e) { console.error("AudioHack failed", e); }

                // Delay Web start to allow Native plugin to release Mic fully
                safetyTimeout = setTimeout(() => {
                    if (isActive) startWeb();
                }, 500);
            }
        } else {
            setIsListening(false);
            if (engine === 'VOSK') {
                stopVosk();
            } else if (isNative) {
                stopNative();
            } else {
                // Cleanup Web
                if (recognitionRef.current) {
                    recognitionRef.current.abort();
                    recognitionRef.current = null;
                }

                // Cleanup Audio Hack
                try {
                    if ((window as any)._silentAudioOsc) {
                        (window as any)._silentAudioOsc.stop();
                        (window as any)._silentAudioOsc = null;
                    }
                    if ((window as any)._silentAudioCtx) {
                        (window as any)._silentAudioCtx.close();
                        (window as any)._silentAudioCtx = null;
                    }
                } catch { }

                if ((window as any)._tempAudioStream) {
                    (window as any)._tempAudioStream.getTracks().forEach((track: any) => track.stop());
                    (window as any)._tempAudioStream = null;
                }
                if (webRestartTimeout) clearTimeout(webRestartTimeout);
                if (safetyTimeout) clearTimeout(safetyTimeout);
                if (nativeRestartTimeout) clearTimeout(nativeRestartTimeout);
            }
        }

        return () => {
            isActive = false;
            // Immediate cleanup
            if (engine === 'VOSK') {
                stopVosk();
            } else if (isNative) {
                stopNative();
            } else {
                if (recognitionRef.current) {
                    recognitionRef.current.abort();
                }
                // Cleanup Audio Hack
                try {
                    if ((window as any)._silentAudioOsc) {
                        (window as any)._silentAudioOsc.stop();
                    }
                    if ((window as any)._silentAudioCtx) {
                        (window as any)._silentAudioCtx.close();
                    }
                } catch { }

                if ((window as any)._tempAudioStream) {
                    (window as any)._tempAudioStream.getTracks().forEach((track: any) => track.stop());
                }
            }
            if (webRestartTimeout) clearTimeout(webRestartTimeout);
            if (safetyTimeout) clearTimeout(safetyTimeout);
            if (nativeRestartTimeout) clearTimeout(nativeRestartTimeout);
            // nativeInterval cleanup removed
        };
    }, [shouldListen, isNative, processTranscript, lang, engine]);

    return { isListening, lastTranscript, error, isNative };
};
