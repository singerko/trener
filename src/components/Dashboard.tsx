
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ArrowDown, ArrowUp, Download, Edit2, MoreVertical, Plus, Play, Mic, MicOff, SlidersHorizontal, Upload, Volume2, VolumeX } from 'lucide-react';
import { parseWorkoutExportPackage } from '../lib/workoutTransfer';
import type { WorkoutPlan } from '../lib/types';
import { shareWorkoutPlan } from '../lib/workoutShare';
import SingerLandLogo from './SingerLandLogo';

export default function Dashboard() {
    const { plany, cviky, settings, toggleVoiceControl, toggleTTS, importWorkoutPackage, movePlan } = useStore();
    const navigate = useNavigate();
    const importInputRef = useRef<HTMLInputElement>(null);
    const [transferMessage, setTransferMessage] = useState('');
    const [openMenuPlanId, setOpenMenuPlanId] = useState<string | null>(null);

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
