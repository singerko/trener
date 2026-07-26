
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ArrowDown, ArrowUp, Clock, Download, Dumbbell, Edit2, ListOrdered, MoreVertical, Plus, Play, Mic, MicOff, RotateCcw, SlidersHorizontal, Timer, Upload, Volume2, VolumeX } from 'lucide-react';
import { parseWorkoutExportPackage } from '../lib/workoutTransfer';
import type { CvikType, WorkoutPlan } from '../lib/types';
import { shareWorkoutPlan } from '../lib/workoutShare';
import SingerLandLogo from './SingerLandLogo';
import { saveRuntimeWorkoutPlan } from '../lib/workoutRuntime';

export default function Dashboard() {
    const { plany, cviky, settings, toggleVoiceControl, toggleTTS, importWorkoutPackage, movePlan } = useStore();
    const navigate = useNavigate();
    const importInputRef = useRef<HTMLInputElement>(null);
    const [transferMessage, setTransferMessage] = useState('');
    const [openMenuPlanId, setOpenMenuPlanId] = useState<string | null>(null);
    const [showQuickExercise, setShowQuickExercise] = useState(false);
    const [quickType, setQuickType] = useState<CvikType>('DRZANE_OPAKOVANIA');
    const [quickSets, setQuickSets] = useState('4');
    const [quickTarget, setQuickTarget] = useState('1');
    const [quickHoldSec, setQuickHoldSec] = useState('20');
    const [quickRestBetweenRepsSec, setQuickRestBetweenRepsSec] = useState('0');
    const [quickMetronomeSec, setQuickMetronomeSec] = useState('2');
    const [quickPhaseCount, setQuickPhaseCount] = useState('3');
    const [quickPhaseDurationsSec, setQuickPhaseDurationsSec] = useState<string[]>(['10', '5', '3']);

    const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const payload = parseWorkoutExportPackage(await file.text());
            const result = importWorkoutPackage(payload);
            const action = result.mode === 'updated' ? 'aktualizovaný' : 'importovaný';
            setTransferMessage(
                `Tréning "${result.planName}" bol ${action}. Nové cviky: ${result.addedExercises}, existujúce: ${result.reusedExercises}.`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Import tréningu zlyhal';
            alert(message);
        } finally {
            event.target.value = '';
        }
    };

    const handleExport = async (plan: WorkoutPlan) => {
        try {
            const transferMode = await shareWorkoutPlan(plan, cviky);
            setTransferMessage(
                transferMode === 'shared'
                    ? `Otvoril som zdieľanie tréningu "${plan.nazov}".`
                    : `Tréning "${plan.nazov}" bol exportovaný do súboru.`,
            );
            setOpenMenuPlanId(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Export tréningu zlyhal';
            alert(message);
        }
    };

    const handleMenuNavigate = (path: string) => {
        setOpenMenuPlanId(null);
        navigate(path);
    };

    const parseQuickPositiveInt = (value: string, fieldName: string) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
            alert(`${fieldName} musí byť celé číslo väčšie ako 0`);
            return null;
        }
        return parsed;
    };

    const updateQuickType = (type: CvikType) => {
        setQuickType(type);
        if (type === 'CASOVY') {
            setQuickTarget((value) => value || '30');
        } else if (type === 'DRZANE_OPAKOVANIA') {
            setQuickTarget((value) => value || '1');
        } else if (type === 'FAZOVE') {
            setQuickTarget((value) => value || '5');
        } else {
            setQuickTarget((value) => value || '10');
        }
    };

    const getQuickTypeLabel = (type: CvikType) => {
        if (type === 'CASOVY') return 'Čas';
        if (type === 'DRZANE_OPAKOVANIA') return 'Držané';
        if (type === 'METRONOM') return 'Metronóm';
        if (type === 'FAZOVE') return 'Fázové';
        return 'Počty';
    };

    const handleQuickExerciseStart = () => {
        const setCount = parseQuickPositiveInt(quickSets, 'Počet sérií');
        if (setCount === null) return;
        const target = parseQuickPositiveInt(quickTarget, quickType === 'CASOVY' ? 'Trvanie' : 'Počet opakovaní');
        if (target === null) return;

        const holdSec = quickType === 'DRZANE_OPAKOVANIA'
            ? parseQuickPositiveInt(quickHoldSec, 'Držať')
            : undefined;
        if (holdSec === null) return;
        let restBetweenRepsSec: number | undefined;
        if (quickType === 'DRZANE_OPAKOVANIA') {
            const parsedRest = Number.parseInt(quickRestBetweenRepsSec, 10);
            if (!Number.isFinite(parsedRest) || parsedRest < 0) {
                alert('Pauza musí byť celé číslo aspoň 0');
                return;
            }
            restBetweenRepsSec = parsedRest;
        }
        const metronomeSec = quickType === 'METRONOM'
            ? parseQuickPositiveInt(quickMetronomeSec, 'Interval metronómu')
            : undefined;
        if (metronomeSec === null) return;
        let phaseDurationsSec: number[] | undefined;
        if (quickType === 'FAZOVE') {
            const phaseCount = parseQuickPositiveInt(quickPhaseCount, 'Počet fáz');
            if (phaseCount === null) return;
            phaseDurationsSec = [];
            for (let index = 0; index < phaseCount; index += 1) {
                const phaseDuration = parseQuickPositiveInt(quickPhaseDurationsSec[index], `Fáza ${index + 1}`);
                if (phaseDuration === null) return;
                phaseDurationsSec.push(phaseDuration);
            }
            const parsedRest = Number.parseInt(quickRestBetweenRepsSec, 10);
            if (!Number.isFinite(parsedRest) || parsedRest < 0) {
                alert('Pauza musí byť celé číslo aspoň 0');
                return;
            }
            restBetweenRepsSec = parsedRest;
        }

        const typeLabel = getQuickTypeLabel(quickType);
        const planId = `quick-exercise-${crypto.randomUUID()}`;
        const setId = crypto.randomUUID();
        const itemId = crypto.randomUUID();
        const plan: WorkoutPlan = {
            id: planId,
            nazov: `Rýchle cvičenie - ${typeLabel}`,
            createdAt: Date.now(),
            skipHistory: true,
            sety: [{
                id: setId,
                nazov: 'Rýchle cvičenie',
                typ: 'NORMAL',
                opakovania: setCount,
                polozky: [{
                    id: itemId,
                    cvik_id: `quick-${quickType.toLowerCase()}`,
                    cvikNazov: `Rýchle cvičenie - ${typeLabel}`,
                    cvikPopis: '',
                    typ: quickType,
                    ciel: target,
                    holdSec,
                    restBetweenRepsSec,
                    restAfterSec: quickType === 'DRZANE_OPAKOVANIA' ? 0 : undefined,
                    metronomeSec,
                    phaseDurationsSec,
                }],
            }],
        };

        saveRuntimeWorkoutPlan(plan);
        navigate(`/trening/${plan.id}?custom=1`);
    };

    return (
        <div className="p-4 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-6">
                <SingerLandLogo subtitle="TRENER" size="sm" />
                <div className="flex gap-2">
                    <button
                        onClick={toggleTTS}
                        className={`p-3 rounded-full transition-all ${settings.ttsEnabled ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}
                    >
                        {settings.ttsEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                    </button>
                    <button
                        onClick={toggleVoiceControl}
                        className={`p-3 rounded-full transition-all ${settings.voiceControlEnabled ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}
                    >
                        {settings.voiceControlEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Moje Tréningy</h1>
                <div className="flex gap-2">
                    <input
                        ref={importInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={handleImportFile}
                    />
                    <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <Upload size={20} /> Import
                    </button>
                    <Link to="/editor/new" className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
                        <Plus size={20} /> Nový
                    </Link>
                </div>
            </div>

            {transferMessage && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
                    {transferMessage}
                </div>
            )}

            <div className="mt-4 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-black text-slate-900 dark:text-white">Rýchle cvičenie</h2>
                        <div className="text-sm text-amber-800 dark:text-amber-300">
                            Jednorazovo bez tvorby tréningu
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowQuickExercise(value => !value)}
                        className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-black text-slate-900 active:scale-95 transition-transform"
                    >
                        Nastaviť
                    </button>
                </div>

                {showQuickExercise ? (
                    <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-5 gap-1 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-1">
                            {([
                                ['POCTOVY', Dumbbell],
                                ['CASOVY', Clock],
                                ['DRZANE_OPAKOVANIA', RotateCcw],
                                ['METRONOM', Timer],
                                ['FAZOVE', ListOrdered],
                            ] as const).map(([type, Icon]) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => updateQuickType(type)}
                                    className={`flex items-center justify-center rounded px-1 py-2 text-[10px] font-black transition-colors ${quickType === type
                                        ? 'bg-amber-400 text-slate-950'
                                        : 'text-slate-400 dark:text-slate-500'
                                        }`}
                                >
                                    <Icon size={14} />
                                    <span className="ml-1 hidden min-[380px]:inline">{getQuickTypeLabel(type)}</span>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <label>
                                <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">Série</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={quickSets}
                                    onChange={event => setQuickSets(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-3 text-center text-lg font-black text-slate-800 dark:text-white outline-none focus:border-amber-500"
                                />
                            </label>
                            <label>
                                <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                                    {quickType === 'CASOVY' ? 'Trvanie' : 'Opakovania'}
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    value={quickTarget}
                                    onChange={event => setQuickTarget(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-3 text-center text-lg font-black text-slate-800 dark:text-white outline-none focus:border-amber-500"
                                />
                            </label>
                        </div>

                        {quickType === 'DRZANE_OPAKOVANIA' ? (
                            <div className="grid grid-cols-2 gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 p-2">
                                <label>
                                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">Držať</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={quickHoldSec}
                                        onChange={event => setQuickHoldSec(event.target.value)}
                                        className="mt-1 w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-3 text-center text-lg font-black text-slate-800 dark:text-white outline-none focus:border-emerald-500"
                                    />
                                </label>
                                <label>
                                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">Pauza</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={quickRestBetweenRepsSec}
                                        onChange={event => setQuickRestBetweenRepsSec(event.target.value)}
                                        className="mt-1 w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-3 text-center text-lg font-black text-slate-800 dark:text-white outline-none focus:border-emerald-500"
                                    />
                                </label>
                            </div>
                        ) : null}

                        {quickType === 'METRONOM' ? (
                            <label className="block rounded-lg border border-violet-200 dark:border-violet-900/60 bg-violet-50 dark:bg-violet-950/20 p-2">
                                <span className="text-[10px] font-black uppercase text-violet-700 dark:text-violet-300">Každých</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={quickMetronomeSec}
                                    onChange={event => setQuickMetronomeSec(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 p-3 text-center text-lg font-black text-slate-800 dark:text-white outline-none focus:border-violet-500"
                                />
                            </label>
                        ) : null}

                        {quickType === 'FAZOVE' ? (
                            <div className="rounded-lg border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50 dark:bg-cyan-950/20 p-2 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <label>
                                        <span className="text-[10px] font-black uppercase text-cyan-700 dark:text-cyan-300">Fázy</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={quickPhaseCount}
                                            onChange={event => {
                                                const nextPhaseCount = event.target.value;
                                                setQuickPhaseCount(nextPhaseCount);
                                                const parsedCount = Number.parseInt(nextPhaseCount, 10);
                                                if (!Number.isFinite(parsedCount) || parsedCount < 1) return;
                                                setQuickPhaseDurationsSec(previous => Array.from({ length: parsedCount }, (_, index) => previous[index] ?? '5'));
                                            }}
                                            className="mt-1 w-full rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-900 p-3 text-center text-lg font-black text-slate-800 dark:text-white outline-none focus:border-cyan-500"
                                        />
                                    </label>
                                    <label>
                                        <span className="text-[10px] font-black uppercase text-cyan-700 dark:text-cyan-300">Pauza</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={quickRestBetweenRepsSec}
                                            onChange={event => setQuickRestBetweenRepsSec(event.target.value)}
                                            className="mt-1 w-full rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-900 p-3 text-center text-lg font-black text-slate-800 dark:text-white outline-none focus:border-cyan-500"
                                        />
                                    </label>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {quickPhaseDurationsSec.map((duration, index) => (
                                        <label key={index}>
                                            <span className="text-[10px] font-black uppercase text-cyan-700 dark:text-cyan-300">Fáza {index + 1}</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={duration}
                                                onChange={event => {
                                                    const nextDurations = [...quickPhaseDurationsSec];
                                                    nextDurations[index] = event.target.value;
                                                    setQuickPhaseDurationsSec(nextDurations);
                                                }}
                                                className="mt-1 w-full rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-900 p-3 text-center text-lg font-black text-slate-800 dark:text-white outline-none focus:border-cyan-500"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <button
                            type="button"
                            onClick={handleQuickExerciseStart}
                            className="w-full rounded-xl bg-green-600 py-3 font-black text-white shadow-sm active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
                        >
                            <Play size={18} fill="currentColor" /> Spustiť
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="grid gap-3 mt-4">
                {plany.length === 0 && (
                    <div className="text-center p-8 text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800/50 rounded-xl border border-transparent dark:border-slate-700">
                        Nemáš žiadne tréningy. Vytvor si prvý!
                    </div>
                )}
                {plany.map((p, index) => (
                    <div key={p.id} className="relative bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-neutral-100 dark:border-slate-700 flex justify-between items-center gap-3 transition-colors">
                        <div className="flex shrink-0 flex-col gap-1">
                            <button
                                type="button"
                                onClick={() => movePlan(p.id, -1)}
                                disabled={index === 0}
                                className="p-1 text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-20 disabled:hover:text-slate-300"
                                title="Posunúť vyššie"
                            >
                                <ArrowUp size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => movePlan(p.id, 1)}
                                disabled={index === plany.length - 1}
                                className="p-1 text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-20 disabled:hover:text-slate-300"
                                title="Posunúť nižšie"
                            >
                                <ArrowDown size={16} />
                            </button>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 truncate">{p.nazov}</h3>
                            <div className="text-sm text-neutral-500 dark:text-slate-400">{p.sety.length} setov</div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <button
                                type="button"
                                onClick={() => setOpenMenuPlanId(openMenuPlanId === p.id ? null : p.id)}
                                className="p-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 transition-colors bg-slate-50 dark:bg-slate-700/50 rounded-full"
                                title="Možnosti tréningu"
                            >
                                <MoreVertical size={20} />
                            </button>
                            <Link to={`/trening/${p.id}`} className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-3 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors shadow-sm">
                                <Play size={20} fill="currentColor" />
                            </Link>
                        </div>

                        {openMenuPlanId === p.id && (
                            <div className="absolute right-4 top-16 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-xl">
                                <button
                                    type="button"
                                    onClick={() => handleMenuNavigate(`/editor/${p.id}`)}
                                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3"
                                >
                                    <Edit2 size={18} className="text-blue-500" /> Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleExport(p)}
                                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3"
                                >
                                    <Download size={18} className="text-emerald-500" /> Export
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMenuNavigate(`/start/${p.id}`)}
                                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3"
                                >
                                    <SlidersHorizontal size={18} className="text-amber-500" /> Upravený štart
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
