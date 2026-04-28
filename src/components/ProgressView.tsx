
import { useState, useMemo } from 'react';
import { useStore } from '../lib/store';
import { TrendingUp, Calendar, Dumbbell, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { sk } from 'date-fns/locale';

export default function ProgressView() {
    const { history, cviky } = useStore();
    const [selectedCvikId, setSelectedCvikId] = useState<string>(cviky[0]?.id || '');

    // Process data for the selected exercise
    const stats = useMemo(() => {
        if (!selectedCvikId) return [];

        const data: { date: number; reps: number; weight: number; duration: number }[] = [];

        history.forEach(session => {
            session.log.forEach(log => {
                if (log.exerciseId === selectedCvikId) {
                    data.push({
                        date: session.startTs,
                        reps: log.reps,
                        weight: log.vaha || 0,
                        duration: log.durationMs
                    });
                }
            });
        });

        // Sort by date descending (newest first)
        return data.sort((a, b) => b.date - a.date);
    }, [history, selectedCvikId]);

    const sortedCviky = [...cviky].sort((a, b) => a.nazov.localeCompare(b.nazov, 'sk'));

    return (
        <div className="safe-screen bg-slate-50 dark:bg-slate-900 transition-colors">
            <div className="p-4 max-w-md mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Progres</h1>

                {/* Exercise Selector */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 block">Vyber Cvik</label>
                    <select
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg font-bold text-slate-800 dark:text-white outline-none border border-transparent focus:border-blue-500 transition-colors"
                        value={selectedCvikId}
                        onChange={(e) => setSelectedCvikId(e.target.value)}
                    >
                        {sortedCviky.map(c => (
                            <option key={c.id} value={c.id}>{c.nazov}</option>
                        ))}
                    </select>
                </div>

                {/* Stats Summary */}
                {stats.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-500 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/20">
                            <div className="text-blue-100 text-xs font-bold uppercase mb-1">Max Váha</div>
                            <div className="text-3xl font-black">
                                {Math.max(...stats.map(s => s.weight))} <span className="text-sm font-medium opacity-70">kg</span>
                            </div>
                        </div>
                        <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg shadow-emerald-500/20">
                            <div className="text-emerald-100 text-xs font-bold uppercase mb-1">Max Opak.</div>
                            <div className="text-3xl font-black">
                                {Math.max(...stats.map(s => s.reps))}
                            </div>
                        </div>
                    </div>
                )}

                {/* History List */}
                <div>
                    <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 ml-1 flex items-center gap-2">
                        <TrendingUp size={16} />
                        História Výkonov
                    </h2>

                    {stats.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            Pre tento cvik zatiaľ nie sú žiadne záznamy.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {stats.map((stat, i) => (
                                <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-100 dark:bg-slate-700 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300 font-bold text-xs flex-col leading-none">
                                            <span>{format(stat.date, 'd.')}</span>
                                            <span className="text-[9px] uppercase">{format(stat.date, 'MMM', { locale: sk })}</span>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                                                <Calendar size={10} />
                                                {format(stat.date, 'yyyy')}
                                            </div>
                                            <div className="font-bold text-slate-700 dark:text-slate-200">
                                                {/* Relative date text could go here */}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-right">
                                        {stat.weight > 0 && (
                                            <div className="flex flex-col items-end">
                                                <div className="font-black text-blue-600 dark:text-blue-400 text-lg tabular-nums">
                                                    {stat.weight}
                                                </div>
                                                <div className="text-[9px] text-blue-300 dark:text-blue-500 font-bold uppercase flex items-center gap-1">
                                                    <Dumbbell size={10} /> KG
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col items-end w-12">
                                            <div className="font-black text-slate-800 dark:text-white text-lg tabular-nums">
                                                {stat.reps}
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
                                                {stat.reps > 20 ? <Clock size={10} /> : null}
                                                {stat.reps > 20 ? 'Sek' : 'Reps'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
