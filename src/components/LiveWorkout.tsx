
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Play, Pause, SkipForward, SkipBack, X, Ear, Volume2, VolumeX, Plus, SlidersHorizontal, Mic, MicOff } from 'lucide-react';
import type { WorkoutPlan, Cvik, WorkoutSession, ExerciseLog, InputMode, RepEvent, CvikType } from '../lib/types';
import { playSoundEffect } from '../lib/audio';
import { useVoiceControl, type VoiceCommand } from '../lib/voice';
import { speak, stopSpeech } from '../lib/tts';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { clsx } from 'clsx';
import { loadRuntimeWorkoutPlan } from '../lib/workoutRuntime';

// Flattened Item for Execution Queue
interface QueueItem {
    id: string; // Unique instance ID
    cvik: Cvik;
    target: number; // count or seconds
    setNazov: string;
    setIndex: number; // 1/3
    setTotal: number;
    type: CvikType;
    // Metadata for logging
    workoutSetId: string;
    workoutExerciseId: string;
    vaha?: number;
    holdSec?: number;
    restBetweenRepsSec?: number;
    restAfterSec?: number;
    metronomeSec?: number;
}

type HeldRepPhase = 'HOLD' | 'REST_BETWEEN_REPS';

type QuickEditDraft = {
    target: string;
    vaha: string;
    holdSec: string;
    restBetweenRepsSec: string;
    metronomeSec: string;
    setTotal: string;
};

const workoutFinishMessages = [
    'Dobrá práca, tréning je hotový.',
    'Išlo ti to skvelo.',
    'Výborne, tréning si si odmakal.',
    'Hotovo. Teším sa na ďalší tréning.',
    'Pekná práca, držíš tempo.',
    'Super výkon, môžeš byť spokojný.',
    'Každý tréning sa počíta.',
    'Dobre si zabral, pokračuj takto.',
    'Výborne, ďalší krok je za tebou.',
    'Paráda, dnes si vyhral nad lenivosťou.',
    'Hotovo. Presne takto sa buduje forma.',
    'Skvelá práca, tréning máš úspešne za sebou.',
    'Dnes to malo energiu. Dobrá práca.',
    'Pekne si to dotiahol do konca.',
    'Výkon hotový. Regeneruj a nabudúce ideme ďalej.',
    'Dobrá robota, toto bol poctivý tréning.',
    'Hotovo. Každý takýto tréning ťa posúva.',
    'Išlo ti to veľmi dobre, len tak ďalej.',
    'Tréning splnený. Som pripravený na ďalší.',
    'Výborne, dnes si ukázal disciplínu.',
];

const getRandomWorkoutFinishMessage = () => {
    return workoutFinishMessages[Math.floor(Math.random() * workoutFinishMessages.length)];
};

export default function LiveWorkout() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { plany, addSession, settings, toggleTTS, toggleVoiceControl } = useStore();
    const isCustomRun = searchParams.get('custom') === '1';
    // --- STATE MANAGEMENT (Stav Aplikácie) ---
    // V Reacte nepoužívame globálne premenné ($var), ale "Hooks".

    // 1. useState: Premenná, ktorá keď sa zmení, spôsobí "Prekreslenie" (Re-render) obrazovky.
    // [hodnota, funkciaNaZmenuHodnoty]
    const [plan, setPlan] = useState<WorkoutPlan | null>(null);
    const [queue, setQueue] = useState<QueueItem[]>([]); // Fronta cvikov
    const [currentIndex, setCurrentIndex] = useState(0); // Index aktuálneho cviku (0, 1, 2...)
    const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED'>('IDLE');

    // Debug State (Prepínač pre zobrazenie ladiaceho okna)
    const [showDebug, setShowDebug] = useState(false);

    // Active Progress (Stav počítadla/časovača)
    const [progress, setProgress] = useState(0); // Počet opakovaní alebo sekúnd
    const [startTime, setStartTime] = useState<number>(0); // Timestamp začiatku cviku
    const [heldRepIndex, setHeldRepIndex] = useState(1);
    const [heldRepPhase, setHeldRepPhase] = useState<HeldRepPhase>('HOLD');
    const [completedHeldReps, setCompletedHeldReps] = useState(0);
    const [quickEditDraft, setQuickEditDraft] = useState<QuickEditDraft | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Session Log (Pole pre ukladanie výsledkov cvikov)
    const [sessionLog, setSessionLog] = useState<ExerciseLog[]>([]);
    const [repEvents, setRepEvents] = useState<RepEvent[]>([]);

    // 2. useRef: Premenná, ktorá "prežije" prekreslenie, ale jej zmena NEVYVOLÁ prekreslenie.
    // Používame to na veci, ktoré bežia na pozadí (časovače, zámky, ID relácie).
    const sessionStartRef = useRef<number>(Date.now());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null); // Odkaz na setInterval (aby sme ho vedeli zrušiť)
    const metronomeEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const metronomeNextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionModeRef = useRef<InputMode | null>(null);
    const suppressNextIdleAnnouncementRef = useRef(false);

    // Beep / Sound Mock
    const playSound = (type: 'BEEP' | 'START' | 'FINISH' | 'TICK') => {
        playSoundEffect(type);
    };

    // --- LOGIC HANDLERS (Hoisted for Voice) ---

    // Helper for ordinals
    const getOrdinal = (n: number) => {
        const ordinals = ['nulté', 'prvé', 'druhé', 'tretie', 'štvrté', 'piate', 'šieste', 'siedme', 'ôsme', 'deviate', 'desiate'];
        return ordinals[n] || `${n}-té`;
    };

    const getRepWord = (n: number) => {
        const words = ['', 'Raz', 'Dva', 'Tri', 'Štyri', 'Päť', 'Šesť', 'Sedem', 'Osem', 'Deväť', 'Desať', 'Jedenásť', 'Dvanásť'];
        return words[n] || `${n}`;
    };

    const getMetronomeCountdownText = (rep: number, target: number) => {
        const remaining = target - rep + 1;
        if (remaining === 3) return 'Ešte 3';
        if (remaining === 2) return '2';
        if (remaining === 1) return '1';
        return null;
    };

    const clearMetronomeTimeouts = () => {
        if (metronomeEndTimeoutRef.current) clearTimeout(metronomeEndTimeoutRef.current);
        if (metronomeNextTimeoutRef.current) clearTimeout(metronomeNextTimeoutRef.current);
        metronomeEndTimeoutRef.current = null;
        metronomeNextTimeoutRef.current = null;
    };

    // --- VOICE LOCKOUT LOGIC (Logika Zámku) ---
    // Problém: Keď aplikácia rozpráva (TTS), mikrofón to počuje a môže to omylom rozpoznať ako príkaz.
    // Riešenie: Semafor.

    // useRef(0) -> Počítadlo. Koľko "viet" máme v rade na rozprávanie.
    const voiceLockoutCounter = useRef(0);
    const [voiceLockout, setVoiceLockout] = useState(false); // Toto je len pre UI (aby svietilo červené "BLOCKED")

    // useEffect: Startup Blindness ("Slepota" pri štarte)
    // Keď sa komponent "Namontuje" (Mount), spustí sa tento kód raz.
    // Zamkneme hlas na 3 sekundy, aby sa systém ustálil a ignoroval úvodný šum.
    useEffect(() => {
        voiceLockoutCounter.current += 1; // Zdvihneme závoru
        setVoiceLockout(true);

        const timer = setTimeout(() => {
            voiceLockoutCounter.current -= 1; // Spustíme závoru
            if (voiceLockoutCounter.current <= 0) {
                voiceLockoutCounter.current = 0;
                setVoiceLockout(false);
            }
        }, 3000); // 3000ms = 3 sekundy

        // Cleanup: Akcia pri odchode (Unmount). Vyčistíme timer.
        return () => clearTimeout(timer);
    }, []); // Prázdne pole [] znamená "Spusti len raz pri štarte"

    // Wrapper pre "Bezpečné Rozprávanie"
    // Táto funkcia zabezpečuje, že kým TTS (Text-to-Speech) hovorí, "uši" (mikrofón) sú zapchaté.
    const safeSpeak = async (text: string, options: { interrupt?: boolean } = {}) => {
        if (settings.ttsEnabled) {
            // 1. Zamkneme (Increment Semaphore)
            voiceLockoutCounter.current += 1;
            setVoiceLockout(true);

            // 2. Odhadneme ako dlho to bude trvať (Počet písmen * rýchlosť)
            // Pretože niekedy plugin povie "hotovo" skôr, než naozaj dohovorí.
            const estimatedMs = 800 + (text.length * 80);

            // 3. Spustíme rozprávanie
            const speechPromise = speak(text, 'sk-SK', options);

            // 4. Vyrobíme si "sľub" (Promise), ktorý počká minimálne ten odhadovaný čas.
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, estimatedMs));

            try {
                // 'Promise.all' čaká, kým sa splnia OBA sľuby (aj dohovorí plugin, aj prejde čas).
                await Promise.all([speechPromise, timeoutPromise]);
            } finally {
                // 5. Odomkneme (Decrement Semaphore)
                // Ale s oneskorením 1.5 sekundy (Echo Cancellation), aby sme nepočuli ozvenu.
                setTimeout(() => {
                    voiceLockoutCounter.current -= 1;
                    if (voiceLockoutCounter.current <= 0) {
                        voiceLockoutCounter.current = 0;
                        setVoiceLockout(false);
                    }
                }, 1500);
            }
        }
    };

    const recordInputMode = (source?: 'BUTTON' | 'VOICE') => {
        if (!source) return;
        if (!sessionModeRef.current) {
            sessionModeRef.current = source;
            return;
        }
        if (sessionModeRef.current !== source) {
            sessionModeRef.current = 'MIXED';
        }
    };

    const handleStart = (source: 'BUTTON' | 'VOICE' = 'BUTTON') => {
        if (source === 'VOICE' && voiceLockoutCounter.current > 0 && status !== 'IDLE' && status !== 'PAUSED') {
            console.warn(`handleStart BLOCKED (Source: ${source}, Lock: ${voiceLockoutCounter.current})`);
            return;
        }

        console.log(`handleStart Executed (Source: ${source})`);
        recordInputMode(source);

        setStatus('RUNNING');
        setStartTime(Date.now());
        playSound('START');

        if (status === 'PAUSED') {
            safeSpeak("Pokračujeme");
        } else {
            const current = queue[currentIndex];
            if (current?.type === 'DRZANE_OPAKOVANIA') {
                safeSpeak(`${getRepWord(heldRepIndex)}. Drž.`);
            }
        }
    };

    const handlePause = () => {
        setStatus('PAUSED');
        safeSpeak("Pauza", { interrupt: true });
    };

    const requestWorkoutExit = useCallback(() => {
        if (status === 'FINISHED') {
            navigate('/');
            return;
        }

        setShowExitConfirm(true);
    }, [navigate, status]);

    const confirmWorkoutExit = () => {
        stopSpeech();
        navigate('/');
    };

    const handleFinishWorkout = (finalLog: ExerciseLog[]) => {
        const session: WorkoutSession = {
            id: crypto.randomUUID(),
            planId: plan!.id,
            startTs: sessionStartRef.current,
            endTs: Date.now(),
            mode: sessionModeRef.current || 'BUTTON',
            log: finalLog
        };
        if (!plan?.skipHistory) {
            addSession(session);
        }
        setStatus('FINISHED');
        safeSpeak(`Koniec tréningu. ${getRandomWorkoutFinishMessage()}`, { interrupt: true });
    };

    const handleRep = (source: 'BUTTON' | 'VOICE' = 'BUTTON') => {
        const current = queue[currentIndex];
        if (!current || current.type !== 'POCTOVY' || status !== 'RUNNING') return;
        recordInputMode(source);
        const nextProgress = progress + 1;
        const nextEvent: RepEvent = { value: repEvents.length + 1, ts: Date.now(), source };
        const nextEvents = [...repEvents, nextEvent];

        playSound('BEEP');
        setProgress(nextProgress);
        setRepEvents(nextEvents);

        if (nextProgress >= current.target) {
            handleNext(source, { reps: nextProgress, events: nextEvents });
        }
    };

    const resetHeldRepState = () => {
        setHeldRepIndex(1);
        setHeldRepPhase('HOLD');
        setCompletedHeldReps(0);
    };

    const parseQuickPositiveInt = (value: string, fallback: number) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) return fallback;
        return parsed;
    };

    const parseQuickNonNegativeInt = (value: string, fallback: number) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0) return fallback;
        return parsed;
    };

    const parseQuickWeight = (value: string) => {
        if (value.trim() === '') return undefined;
        const parsed = Number.parseFloat(value.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
        return parsed;
    };

    const openQuickEdit = () => {
        const current = queue[currentIndex];
        if (!current) return;

        setQuickEditDraft({
            target: String(current.target),
            vaha: current.vaha === undefined ? '' : String(current.vaha),
            holdSec: String(current.holdSec ?? 20),
            restBetweenRepsSec: String(current.restBetweenRepsSec ?? 0),
            metronomeSec: String(current.metronomeSec ?? 2),
            setTotal: String(current.setTotal),
        });
    };

    const commitQuickEdit = () => {
        const current = queue[currentIndex];
        if (!current || !quickEditDraft) return;

        const nextTarget = parseQuickPositiveInt(quickEditDraft.target, current.target);
        const nextVaha = parseQuickWeight(quickEditDraft.vaha);
        const nextHoldSec = parseQuickPositiveInt(quickEditDraft.holdSec, current.holdSec ?? 20);
        const nextRestBetweenRepsSec = parseQuickNonNegativeInt(
            quickEditDraft.restBetweenRepsSec,
            current.restBetweenRepsSec ?? 0,
        );
        const nextMetronomeSec = parseQuickPositiveInt(quickEditDraft.metronomeSec, current.metronomeSec ?? 2);
        const requestedSetTotal = parseQuickPositiveInt(quickEditDraft.setTotal, current.setTotal);
        const nextSetTotal = Math.min(Math.max(requestedSetTotal, current.setIndex), current.setTotal);

        setQueue((previousQueue) => previousQueue
            .map((item, index) => {
                const shouldUpdateExercise = index >= currentIndex && item.workoutExerciseId === current.workoutExerciseId;
                const shouldUpdateSetTotal = item.workoutSetId === current.workoutSetId;

                return {
                    ...item,
                    target: shouldUpdateExercise ? nextTarget : item.target,
                    vaha: shouldUpdateExercise ? nextVaha : item.vaha,
                    holdSec: shouldUpdateExercise && item.type === 'DRZANE_OPAKOVANIA' ? nextHoldSec : item.holdSec,
                    restBetweenRepsSec: shouldUpdateExercise && item.type === 'DRZANE_OPAKOVANIA'
                        ? nextRestBetweenRepsSec
                        : item.restBetweenRepsSec,
                    metronomeSec: shouldUpdateExercise && item.type === 'METRONOM' ? nextMetronomeSec : item.metronomeSec,
                    setTotal: shouldUpdateSetTotal ? nextSetTotal : item.setTotal,
                };
            })
            .filter((item, index) => {
                if (item.workoutSetId !== current.workoutSetId) return true;
                if (index <= currentIndex) return true;
                return item.setIndex <= nextSetTotal;
            }));

        setQuickEditDraft(null);
    };

    const handleNext = (
        source?: 'BUTTON' | 'VOICE',
        overrides: { reps?: number; events?: RepEvent[] } = {},
        options: { stopCurrentSpeech?: boolean; announceMetronomeTransition?: boolean } = {},
    ) => {
        recordInputMode(source);
        if (options.stopCurrentSpeech ?? true) {
            stopSpeech();
        }

        // Log current result
        const current = queue[currentIndex];
        // Safety check
        if (!current) return;

        const logItem: ExerciseLog = {
            exerciseId: current.cvik.id,
            exerciseName: current.cvik.nazov,
            setId: current.workoutSetId,
            setNazov: current.setNazov,
            roundIndex: current.setIndex,
            roundTotal: current.setTotal,
            timestamp: startTime || Date.now(),
            durationMs: startTime ? Date.now() - startTime : 0,
            reps: overrides.reps ?? (
                current.type === 'POCTOVY' || current.type === 'METRONOM'
                    ? progress
                    : current.type === 'DRZANE_OPAKOVANIA'
                        ? completedHeldReps
                        : Math.min(progress, current.target)
            ),
            vaha: current.vaha,
            typ: current.type,
            holdSec: current.holdSec,
            restBetweenRepsSec: current.restBetweenRepsSec,
            restAfterSec: current.restAfterSec,
            metronomeSec: current.metronomeSec,
            completedHeldReps: current.type === 'DRZANE_OPAKOVANIA' ? (overrides.reps ?? completedHeldReps) : undefined,
            events: overrides.events ?? repEvents
        };

        // Critical: Calculate new log immediately to pass to finish handler if needed
        const newLog = [...sessionLog, logItem];
        setSessionLog(newLog);

        // Move next
        if (currentIndex < queue.length - 1) {
            // Logic for what just ended
            const nextItem = queue[currentIndex + 1];

            // Check if Round Ended (Different index in same set, or different set)
            const isRoundEnd = current.setIndex !== nextItem.setIndex;
            const isSetEnd = current.workoutSetId !== nextItem.workoutSetId;

            if (plan?.skipHistory) {
                // Quick exercises should move between rounds without workout/exercise announcements.
            } else if (options.announceMetronomeTransition) {
                const announcementParts = ['Koniec.'];
                if (isSetEnd) {
                    announcementParts.push('Koniec série.');
                    announcementParts.push(`Začíname sériu ${nextItem.setNazov}.`);
                } else if (isRoundEnd) {
                    announcementParts.push(`Koniec série, ${getOrdinal(current.setIndex)} kolo.`);
                }
                announcementParts.push(`Nasleduje: ${nextItem.cvik.nazov}`);
                suppressNextIdleAnnouncementRef.current = true;
                safeSpeak(announcementParts.join(' '), { interrupt: true });
            } else if (isSetEnd) {
                safeSpeak("Koniec série", { interrupt: true });
            } else if (isRoundEnd) {
                // Determine which round finished
                safeSpeak(`Koniec série, ${getOrdinal(current.setIndex)} kolo`, { interrupt: true });
            } else {
                // Just moving to next exercise in same round
                // speak("Ďalej"); // Optional, maybe too chatty
            }

            // Check if New Set Starting
            // Logic moved to Effect reacting to currentIndex change in IDLE mode
            // BUT wait, handleNext sets status to IDLE.

            // So we rely on the Effect to announce the NEW state.

            // However, that effect triggers on mount and index change.
            // If we speak here, it overlaps. 
            // So we REMOVE "Začíname sériu..." from here and put it in the Effect.

            // safeSpeak(`Nasleduje: ${nextItem.cvik.nazov}`); // This goes to Effect

            // Trigger Voice Lockout when finishing exercise to prevent "buffer" start
            voiceLockoutCounter.current += 1;
            setVoiceLockout(true);
            setTimeout(() => {
                voiceLockoutCounter.current -= 1;
                if (voiceLockoutCounter.current <= 0) setVoiceLockout(false);
            }, 2000); // 2s cooldown

            setCurrentIndex(prev => prev + 1);
            setStatus('IDLE'); // Wait for start of next exercise
            setProgress(0);
            setRepEvents([]);
            resetHeldRepState();
        } else {
            // Last item finished
            handleFinishWorkout(newLog);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setStatus('IDLE');
            setProgress(0);
            setRepEvents([]);
            resetHeldRepState();
            stopSpeech();
        }
    };

    // --- VOICE CONTROL ---

    // Voice Command Handler
    const handleVoiceCommand = (cmd: VoiceCommand) => {
        const canStartFromVoice = cmd === 'START' && (status === 'IDLE' || status === 'PAUSED');

        // If locked out, ignore everything
        if (voiceLockoutCounter.current > 0 && !canStartFromVoice) {
            console.log("Voice Command Blocked (Lockout)");
            return;
        }

        const currentExercise = queue[currentIndex];

        // 1. START Trigger ("Štart", "Jeden", "Raz")
        if (cmd === 'START') {
            if (status === 'IDLE' || status === 'PAUSED') {
                handleStart('VOICE');
            }
            // If RUNNING, ignore start
        }

        // 2. STOP Trigger (Mapped to NEXT)
        else if (cmd === 'NEXT') {
            if (status === 'RUNNING') {
                if (currentExercise?.type === 'POCTOVY' || currentExercise?.type === 'DRZANE_OPAKOVANIA' || currentExercise?.type === 'METRONOM') {
                    // Start Lockout before switching state
                    voiceLockoutCounter.current += 1;
                    setVoiceLockout(true);

                    setTimeout(() => {
                        voiceLockoutCounter.current -= 1;
                        if (voiceLockoutCounter.current <= 0) setVoiceLockout(false);
                    }, 2000); // 2s cooldown

                    handleNext('VOICE');
                }
            } else if (status === 'IDLE') {
                // User said "Stop" while IDLE. Should we skip?
                // User requirement: "start/jeden/raz ... startovat ... Ak bezi cvik ... stop".
                // Doesn't say what Stop does in IDLE. Assuming ignore to be safe.
            }
        }

        else if (cmd === 'PAUSE') {
            if (status === 'RUNNING') {
                recordInputMode('VOICE');
                handlePause();
            }
        }

        else if (cmd === 'REP') {
            if (currentExercise?.type === 'POCTOVY') {
                handleRep('VOICE');
            }
        }
    };

    // Stable Ref pattern for voice callback
    const onVoiceCommandRef = useRef(handleVoiceCommand);
    useEffect(() => {
        onVoiceCommandRef.current = handleVoiceCommand;
    }); // Update ref on every render to capture latest closures? 
    // Actually, simplest is to use 'status' in ref, but 'handleVoiceCommand' closes over 'status'.
    // So updating the ref on every render is correct.

    const stableHandler = useCallback((cmd: VoiceCommand) => {
        onVoiceCommandRef.current(cmd);
    }, []);

    const [voiceLang, setVoiceLang] = useState('sk-SK');
    const [voiceEngine, setVoiceEngine] = useState<'NATIVE' | 'WEB' | 'VOSK'>('VOSK'); // Force Default

    // Force VOSK if something else is persisted or defaulted
    useEffect(() => {
        setVoiceEngine('VOSK');
    }, []);
    // Initialize Voice Hook
    const { isListening, lastTranscript, error: voiceError } = useVoiceControl(settings.voiceControlEnabled, voiceLang, voiceEngine, stableHandler);

    useEffect(() => {
        if (!settings.voiceControlEnabled) {
            setShowDebug(false);
        }
    }, [settings.voiceControlEnabled]);

    useEffect(() => {
        window.TrenerConfirmWorkoutExit = () => {
            requestWorkoutExit();
            return true;
        };

        return () => {
            if (window.TrenerConfirmWorkoutExit) {
                delete window.TrenerConfirmWorkoutExit;
            }
        };
    }, [requestWorkoutExit]);

    // --- KEEP AWAKE (Waze Mode) ---
    useEffect(() => {
        const manageScreen = async () => {
            // Keep the screen awake only when it is needed for an active run
            // or when IDLE is waiting for a voice command.
            if (status === 'RUNNING' || (status === 'IDLE' && settings.voiceControlEnabled)) {
                try {
                    await KeepAwake.keepAwake();
                } catch (e) { console.warn("KeepAwake fail", e); }
            } else {
                try {
                    await KeepAwake.allowSleep();
                } catch { }
            }
        };
        manageScreen();

        return () => {
            const cleanup = async () => {
                try { await KeepAwake.allowSleep(); } catch { }
            };
            cleanup();
        };
    }, [settings.voiceControlEnabled, status]);

    // --- EFFECTS ---

    // Effect to play sound when finished
    useEffect(() => {
        if (status === 'FINISHED') {
            playSound('FINISH');
        }
    }, [status]);

    // Initialization
    useEffect(() => {
        if (!id) return;
        const p = isCustomRun ? loadRuntimeWorkoutPlan(id) ?? plany.find(x => x.id === id) : plany.find(x => x.id === id);
        if (!p) return;
        setPlan(p);

        // Flatten Plan to Queue
        const q: QueueItem[] = [];

        p.sety.forEach(set => {
            for (let i = 0; i < set.opakovania; i++) {
                set.polozky.forEach(item => {
                    const cvik = useStore.getState().cviky.find(c => c.id === item.cvik_id) ?? (
                        item.cvikNazov
                            ? { id: item.cvik_id, nazov: item.cvikNazov, popis: item.cvikPopis ?? '' }
                            : null
                    );
                    if (cvik) {
                        q.push({
                            id: crypto.randomUUID(),
                            cvik,
                            type: item.typ,  // Now from Item
                            target: item.ciel, // Now from Item
                            setNazov: set.nazov,
                            setIndex: i + 1,
                            setTotal: set.opakovania,
                            workoutSetId: set.id,
                            workoutExerciseId: item.id,
                            vaha: item.vaha,
                            holdSec: item.holdSec,
                            restBetweenRepsSec: item.restBetweenRepsSec,
                            restAfterSec: item.restAfterSec,
                            metronomeSec: item.metronomeSec,
                        });
                    }
                });
            }
        });

        setQueue(q);
        setStatus('IDLE');
        setProgress(0);
        setRepEvents([]);
        resetHeldRepState();
        setSessionLog([]);
        sessionModeRef.current = null;

        // Cleanup on unmount
        return () => {
            stopSpeech();
        };
    }, [id, isCustomRun, plany]);


    // Timer Logic for timed exercises and held repetitions
    useEffect(() => {
        if (status === 'RUNNING' && queue[currentIndex]) {
            const current = queue[currentIndex];
            if (current.type === 'POCTOVY') return;

            if (current.type === 'METRONOM') {
                const metronomeSec = Math.max(1, current.metronomeSec ?? 2);
                const metronomeIntervalMs = metronomeSec * 1000;
                const runMetronomeCue = () => {
                    playSound('TICK');
                    setProgress(prev => {
                        if (prev >= current.target) return prev;
                        const next = prev + 1;
                        const countdownText = getMetronomeCountdownText(next, current.target);
                        if (countdownText) {
                            safeSpeak(countdownText, { interrupt: true });
                        }
                        if (next >= current.target) {
                            if (timerRef.current) clearInterval(timerRef.current);
                            metronomeEndTimeoutRef.current = setTimeout(() => {
                                handleNext(undefined, { reps: next }, { announceMetronomeTransition: true });
                            }, metronomeIntervalMs);
                        }
                        return next;
                    });
                };

                runMetronomeCue();
                timerRef.current = setInterval(runMetronomeCue, metronomeIntervalMs);
                return;
            }

            timerRef.current = setInterval(() => {
                setProgress(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            clearMetronomeTimeouts();
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            clearMetronomeTimeouts();
        };
        // handleNext intentionally uses the current render snapshot for the active exercise.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, currentIndex, queue]);

    // Auto-finish timed exercises and held-repetition phases
    useEffect(() => {
        const current = queue[currentIndex];
        if (status === 'RUNNING' && current?.type === 'CASOVY' && progress >= current.target) {
            playSound('BEEP');
            handleNext();
        }
        if (status === 'RUNNING' && current?.type === 'DRZANE_OPAKOVANIA') {
            const holdSec = current.holdSec ?? 20;
            const restBetweenRepsSec = current.restBetweenRepsSec ?? 0;

            if (heldRepPhase === 'HOLD' && progress >= holdSec) {
                const completed = heldRepIndex;
                setCompletedHeldReps(completed);
                playSound('BEEP');

                if (completed >= current.target) {
                    handleNext(undefined, { reps: completed });
                    return;
                }

                if (restBetweenRepsSec > 0) {
                    setHeldRepPhase('REST_BETWEEN_REPS');
                    setProgress(0);
                    safeSpeak('Pauza.', { interrupt: true });
                } else {
                    const nextRep = heldRepIndex + 1;
                    setHeldRepIndex(nextRep);
                    setProgress(0);
                    safeSpeak(`${getRepWord(nextRep)}. Drž.`, { interrupt: true });
                }
            } else if (heldRepPhase === 'REST_BETWEEN_REPS' && progress >= restBetweenRepsSec) {
                const nextRep = heldRepIndex + 1;
                setHeldRepIndex(nextRep);
                setHeldRepPhase('HOLD');
                setProgress(0);
                safeSpeak(`${getRepWord(nextRep)}. Drž.`, { interrupt: true });
            }
        }
        // handleNext intentionally uses the current render snapshot for the active exercise.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [progress, heldRepPhase, heldRepIndex]);

    // TTS STATE ANNOUNCEMENT LOGIC (Intro / Transitions)
    // Only runs when IDLE and currentIndex changes (or on mount)
    useEffect(() => {
        if (status === 'IDLE' && queue.length > 0 && plan) {
            if (plan.skipHistory) {
                return;
            }

            if (suppressNextIdleAnnouncementRef.current) {
                suppressNextIdleAnnouncementRef.current = false;
                return;
            }

            const current = queue[currentIndex];
            // Initial Start (Index 0)
            if (currentIndex === 0 && progress === 0) {
                safeSpeak(`Púšťam tréning ${plan.nazov}`, { interrupt: true });
                safeSpeak(`Začíname sériu ${current.setNazov}`);
                safeSpeak(`Prvý cvik: ${current.cvik.nazov}`);
            } else {
                // Transition to new Index
                // Check if it's a new Set compared to previous?
                // Hard to check previous here without prev ref.
                // But we can just announce "Nasleduje: [Cvik]"

                // If it is the start of a new set (setIndex == 1 and new setID), announce Set.
                // We can check against currentIndex - 1
                const prev = queue[currentIndex - 1];
                if (prev) {
                    if (prev.workoutSetId !== current.workoutSetId) {
                        safeSpeak(`Začíname sériu ${current.setNazov}`);
                    }
                }
                safeSpeak(`Nasleduje: ${current.cvik.nazov}`);
            }
        }
        // TTS announcements should only run on exercise/status transitions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, status, plan, queue]);
    // Careful: status change (finished -> idle) triggers this.
    // Yes, handleNext sets status IDLE. That triggers this effect.
    // Perfect.


    // --- RENDER ---

    if (!plan) return <div className="p-4">Načítavam...</div>;

    if (status === 'FINISHED') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-green-50">
                <h1 className="text-3xl font-bold text-green-800 mb-4">Tréning Dokončený!</h1>
                <p className="mb-8 text-green-700">Dáta boli uložené do histórie.</p>
                <button onClick={() => navigate('/')} className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold">
                    Späť na Domov
                </button>
            </div>
        )
    }

    const currentItem = queue[currentIndex];
    if (!currentItem) return <div>Koniec zoznamu</div>;

    const isTimer = currentItem.type === 'CASOVY';
    const isHeldReps = currentItem.type === 'DRZANE_OPAKOVANIA';
    const isMetronome = currentItem.type === 'METRONOM';
    const isManualCounter = currentItem.type === 'POCTOVY';
    const heldPhaseTarget = heldRepPhase === 'HOLD'
        ? (currentItem.holdSec ?? 20)
        : (currentItem.restBetweenRepsSec ?? 0);
    const progressPercent = isTimer
        ? Math.min(100, (progress / currentItem.target) * 100)
        : isMetronome
            ? Math.min(100, (progress / currentItem.target) * 100)
        : isHeldReps && heldPhaseTarget > 0
            ? Math.min(100, (progress / heldPhaseTarget) * 100)
            : 0;
    const heldRemaining = Math.max(0, heldPhaseTarget - progress);
    const exerciseDescription = currentItem.cvik.popis.trim();
    const heldExerciseInstructions = `${currentItem.target}x držať ${currentItem.holdSec ?? 20}s, pauza ${currentItem.restBetweenRepsSec ?? 0}s`;
    const metronomeInstructions = `${currentItem.target}x automaticky, zvuk každé ${currentItem.metronomeSec ?? 2}s`;

    return (
        <div className="safe-screen bg-neutral-900 text-white flex flex-col relative overflow-hidden">
            {/* Background Progress Bar */}
            <div
                className="absolute top-0 bottom-0 left-0 bg-blue-900/30 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
            />

            {/* Top Info */}
            <div className="relative z-10 p-4 flex justify-between items-start">
                <div>
                    <div className="text-neutral-400 text-sm font-bold uppercase">{currentItem.setNazov} ({currentItem.setIndex}/{currentItem.setTotal})</div>
                    <div className="text-neutral-500 text-xs mt-1 flex items-center gap-2">
                        Cvik {currentIndex + 1} / {queue.length}
                        {settings.voiceControlEnabled && (
                            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-neutral-600'}`} />
                        )}
                        {/* TTS Indicator */}
                        {!settings.ttsEnabled && (
                            <VolumeX size={12} className="text-red-400" />
                        )}
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={openQuickEdit} className="p-2 rounded-full text-amber-300 bg-amber-400/10 hover:bg-amber-400/20">
                        <SlidersHorizontal size={24} />
                    </button>

                    {/* TTS Toggle */}
                    <button onClick={toggleTTS} className={`p-2 rounded-full ${settings.ttsEnabled ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                        {settings.ttsEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                    </button>

                    {/* Voice Control Toggle */}
                    <button
                        onClick={toggleVoiceControl}
                        className={`p-2 rounded-full ${settings.voiceControlEnabled ? 'text-red-400 bg-red-400/10' : 'text-neutral-500 bg-neutral-800/70 hover:text-white'}`}
                        aria-label={settings.voiceControlEnabled ? 'Vypnúť hlasové ovládanie' : 'Zapnúť hlasové ovládanie'}
                        title={settings.voiceControlEnabled ? 'Vypnúť mikrofón' : 'Zapnúť mikrofón'}
                    >
                        {settings.voiceControlEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                    </button>

                    {settings.voiceControlEnabled && (
                        <button onClick={() => setShowDebug(!showDebug)} className={`p-2 rounded-full ${showDebug ? 'text-blue-400 bg-blue-400/10' : 'text-neutral-500 hover:text-white'}`}>
                            <Ear size={24} />
                        </button>
                    )}
                    <button onClick={requestWorkoutExit} className="p-2 text-neutral-500 hover:text-white">
                        <X />
                    </button>
                </div>
            </div>

            {showExitConfirm && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl">
                        <h2 className="text-xl font-black text-white">Opustiť tréning?</h2>
                        <p className="mt-3 text-sm leading-6 text-neutral-300">
                            Prebiehajúci tréning sa ukončí bez uloženia do histórie a neskôr sa doň nebude dať vrátiť.
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-black text-white active:scale-95 transition-transform"
                            >
                                Zostať
                            </button>
                            <button
                                onClick={confirmWorkoutExit}
                                className="rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white active:scale-95 transition-transform"
                            >
                                Opustiť
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Voice Debug Overlay */}
            {showDebug && (
                <div className="absolute top-20 left-4 right-4 z-50 bg-black/90 border border-neutral-700 rounded-xl p-4 text-xs font-mono text-green-400 shadow-2xl backdrop-blur-sm">
                    <div className="flex justify-between border-b border-neutral-800 pb-2 mb-2">
                        <span className="font-bold text-white">HLASOVÉ OVLÁDANIE</span>
                        <div className="flex gap-2">
                            <span className={isListening ? "text-green-400 font-bold" : "text-red-400"}>
                                {isListening ? (voiceLockout ? "BLOCKED (TTS)" : "ON") : "OFF"}
                            </span>
                        </div>
                    </div>

                    {voiceError && (
                        <div className="mb-2 text-red-400">
                            <span className="font-bold">CHYBA:</span> {voiceError}
                        </div>
                    )}

                    <div className="mb-2">
                        <div className="text-neutral-500 mb-1">ROZPOZNANÝ TEXT:</div>
                        <div className="text-xl text-white bg-neutral-800/50 p-2 rounded min-h-[3rem] break-words">
                            {lastTranscript || "..."}
                        </div>
                    </div>

                    <div className="flex gap-1 mb-2">
                        <span className="text-neutral-500 py-1 mr-1">JAZYK:</span>
                        <button
                            onClick={() => setVoiceLang('sk-SK')}
                            className={`px-1 rounded ${voiceLang === 'sk-SK' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                        >
                            SK
                        </button>
                        <button
                            onClick={() => setVoiceLang('en-US')}
                            className={`px-1 rounded ${voiceLang === 'en-US' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                        >
                            EN
                        </button>
                    </div>

                    <div className="flex gap-1 mb-2 pt-2 border-t border-neutral-800">
                        <span className="text-neutral-500 py-1 mr-1">ENGINE:</span>
                        <button
                            onClick={() => setVoiceEngine('NATIVE')}
                            className={`px-1 rounded ${voiceEngine === 'NATIVE' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                        >
                            APP
                        </button>
                        <button
                            onClick={() => setVoiceEngine('WEB')}
                            className={`px-1 rounded ${voiceEngine === 'WEB' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}
                        >
                            WEB
                        </button>
                        <button
                            onClick={() => setVoiceEngine('VOSK')}
                            className={`px-1 rounded ${voiceEngine === 'VOSK' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                        >
                            VOSK
                        </button>
                    </div>

                    <div className="text-neutral-500 pt-2 border-t border-neutral-800">
                        <div>PRÍKAZY:</div>
                        <div className="grid grid-cols-2 gap-1 mt-1 text-[10px]">
                            <span className="text-blue-300">"ŠTART"</span>
                            <span>Spustí cvik</span>
                            <span className="text-blue-300">"ĎALEJ"</span>
                            <span>Ďalší cvik</span>
                            <span className="text-blue-300">"NEXT"</span>
                            <span>Ďalší cvik</span>
                        </div>
                        {/* DEBUG TRANSCRIPT */}
                        <div className="mt-2 text-xs text-yellow-500 font-mono border-t border-gray-800 pt-1">
                            Heard: {lastTranscript || '...'}
                        </div>
                    </div>
                </div>
            )}

            {quickEditDraft && (
                <div className="absolute inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
                    <div className="w-full rounded-t-2xl border-t border-white/10 bg-neutral-950 p-4 shadow-2xl">
                        <div className="mx-auto max-w-md">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-xs font-black uppercase tracking-wide text-amber-300">
                                        Úprava iba pre tento tréning
                                    </div>
                                    <h2 className="truncate text-xl font-black text-white">{currentItem.cvik.nazov}</h2>
                                </div>
                                <button onClick={() => setQuickEditDraft(null)} className="rounded-full p-2 text-neutral-400 hover:text-white">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <label>
                                        <span className="text-[10px] font-black uppercase text-neutral-500">
                                            {currentItem.type === 'CASOVY' ? 'Sekundy' : 'Opakovania'}
                                        </span>
                                        <input
                                            type="number"
                                            min="1"
                                            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-center text-xl font-black text-white outline-none focus:border-amber-400"
                                            value={quickEditDraft.target}
                                            onChange={(event) => setQuickEditDraft({ ...quickEditDraft, target: event.target.value })}
                                        />
                                    </label>
                                    <label>
                                        <span className="text-[10px] font-black uppercase text-neutral-500">Váha</span>
                                        <input
                                            type="number"
                                            min="0"
                                            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-center text-xl font-black text-white outline-none focus:border-amber-400"
                                            value={quickEditDraft.vaha}
                                            onChange={(event) => setQuickEditDraft({ ...quickEditDraft, vaha: event.target.value })}
                                            placeholder="kg"
                                        />
                                    </label>
                                </div>

                                {currentItem.type === 'DRZANE_OPAKOVANIA' && (
                                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                                        <label>
                                            <span className="text-[10px] font-black uppercase text-emerald-300">Držať</span>
                                            <input
                                                type="number"
                                                min="1"
                                                className="mt-1 w-full rounded-lg border border-emerald-700 bg-neutral-900 p-3 text-center text-xl font-black text-white outline-none focus:border-emerald-400"
                                                value={quickEditDraft.holdSec}
                                                onChange={(event) => setQuickEditDraft({ ...quickEditDraft, holdSec: event.target.value })}
                                            />
                                        </label>
                                        <label>
                                            <span className="text-[10px] font-black uppercase text-emerald-300">Pauza</span>
                                            <input
                                                type="number"
                                                min="0"
                                                className="mt-1 w-full rounded-lg border border-emerald-700 bg-neutral-900 p-3 text-center text-xl font-black text-white outline-none focus:border-emerald-400"
                                                value={quickEditDraft.restBetweenRepsSec}
                                                onChange={(event) => setQuickEditDraft({ ...quickEditDraft, restBetweenRepsSec: event.target.value })}
                                            />
                                        </label>
                                    </div>
                                )}

                                {currentItem.type === 'METRONOM' && (
                                    <label className="block rounded-xl border border-violet-400/20 bg-violet-400/10 p-3">
                                        <span className="text-[10px] font-black uppercase text-violet-300">Každých</span>
                                        <input
                                            type="number"
                                            min="1"
                                            className="mt-1 w-full rounded-lg border border-violet-700 bg-neutral-900 p-3 text-center text-xl font-black text-white outline-none focus:border-violet-400"
                                            value={quickEditDraft.metronomeSec}
                                            onChange={(event) => setQuickEditDraft({ ...quickEditDraft, metronomeSec: event.target.value })}
                                        />
                                    </label>
                                )}

                                <label className="block rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-black uppercase text-neutral-500">Celkový počet kôl setu</span>
                                        <span className="text-xs font-bold text-neutral-500">
                                            min. {currentItem.setIndex}, max. {currentItem.setTotal}
                                        </span>
                                    </div>
                                    <input
                                        type="number"
                                        min={currentItem.setIndex}
                                        max={currentItem.setTotal}
                                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-center text-xl font-black text-white outline-none focus:border-amber-400"
                                        value={quickEditDraft.setTotal}
                                        onChange={(event) => setQuickEditDraft({ ...quickEditDraft, setTotal: event.target.value })}
                                    />
                                </label>

                                <button
                                    onClick={commitQuickEdit}
                                    className="w-full rounded-xl bg-amber-400 py-3 font-black text-neutral-950 shadow-lg active:scale-95 transition-transform"
                                >
                                    Použiť v tomto tréningu
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">{currentItem.cvik.nazov}</h1>

                {isHeldReps && (
                    <div className={clsx(
                        "mb-4 px-4 py-2 rounded-full text-sm font-black uppercase tracking-wider",
                        heldRepPhase === 'HOLD' ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20' : 'bg-yellow-400/10 text-yellow-300 border border-yellow-400/20'
                    )}>
                        {heldRepPhase === 'HOLD' ? 'Drž' : 'Pauza'} · {heldRepIndex} / {currentItem.target}
                    </div>
                )}

                {isMetronome && (
                    <div className="mb-4 px-4 py-2 rounded-full text-sm font-black uppercase tracking-wider bg-violet-400/10 text-violet-300 border border-violet-400/20">
                        Metronóm · každé {currentItem.metronomeSec ?? 2}s
                    </div>
                )}

                {/* Visual Target */}
                <div className="text-8xl md:text-9xl font-mono font-bold mb-8 tabular-nums">
                    {isTimer ? (
                        <span>
                            {Math.max(0, currentItem.target - progress)}
                            <span className="text-2xl ml-2 text-neutral-500">s</span>
                        </span>
                    ) : isHeldReps ? (
                        <span>
                            {heldRemaining}
                            <span className="text-2xl ml-2 text-neutral-500">s</span>
                        </span>
                    ) : isMetronome ? (
                        <span>
                            <span className={progress >= currentItem.target ? "text-green-500" : "text-white"}>
                                {progress}
                            </span>
                            <span className="text-4xl text-neutral-600 mx-2">/</span>
                            <span className="text-6xl text-neutral-500">
                                {currentItem.target}
                            </span>
                        </span>
                    ) : (
                        <span>
                            {/* Counter Mode: Show Current / Target */}
                            <span className={progress >= currentItem.target ? "text-green-500" : "text-white"}>
                                {progress}
                            </span>
                            <span className="text-4xl text-neutral-600 mx-2">/</span>
                            <span className="text-6xl text-neutral-500">
                                {currentItem.target}
                            </span>
                        </span>
                    )}
                </div>

                {isHeldReps || isMetronome ? (
                    <div className="max-w-md space-y-2">
                        {exerciseDescription && (
                            <div className="text-neutral-300 text-lg">
                                {exerciseDescription}
                            </div>
                        )}
                        <div className="text-neutral-400 text-base">
                            {isMetronome ? metronomeInstructions : heldExerciseInstructions}
                        </div>
                    </div>
                ) : (
                    <div className="text-neutral-400 text-lg max-w-md">
                        {currentItem.cvik.popis}
                    </div>
                )}

                {currentItem.vaha ? (
                    <div className="mt-8 text-2xl font-bold text-blue-400 bg-blue-400/10 px-6 py-2 rounded-full border border-blue-400/20">
                        {currentItem.vaha} kg
                    </div>
                ) : null}
            </div>

            {/* Controls */}
            <div className="relative z-10 p-6 live-bottom-controls bg-neutral-900/80 backdrop-blur-md border-t border-white/10">
                <div className="flex justify-between items-center gap-3 max-w-md mx-auto">
                    <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="p-4 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-30"
                    >
                        <SkipBack size={24} />
                    </button>

                    {status === 'RUNNING' && isManualCounter ? (
                        <>
                            <button
                                onClick={() => handleRep('BUTTON')}
                                className="w-24 h-24 rounded-full bg-blue-600 text-white flex flex-col items-center justify-center shadow-lg hover:scale-105 transition-transform"
                            >
                                <Plus size={36} />
                                <span className="text-xs font-bold uppercase mt-1">1 rep</span>
                            </button>
                            <button
                                onClick={handlePause}
                                className="p-4 rounded-full bg-yellow-500 text-black hover:bg-yellow-400 transition-colors"
                            >
                                <Pause size={24} fill="currentColor" />
                            </button>
                        </>
                    ) : status === 'RUNNING' ? (
                        <button
                            onClick={handlePause}
                            className="w-24 h-24 rounded-full bg-yellow-500 text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                        >
                            <Pause size={40} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            onClick={() => handleStart('BUTTON')}
                            className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform animate-pulse"
                        >
                            <Play size={40} fill="currentColor" className="ml-2" />
                        </button>
                    )}

                    <button
                        onClick={() => handleNext('BUTTON')}
                        className="p-4 rounded-full bg-neutral-800 text-white hover:bg-green-600 transition-colors"
                    >
                        <SkipForward size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}
