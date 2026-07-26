import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ArrowLeft, Calendar, Clock, Trophy, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { sk } from 'date-fns/locale';

export default function HistoryDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { history, plany, cviky } = useStore();

    const session = history.find(s => s.id === id);

    if (!session) {
        return <div className="p-8 text-center">Tréning sa nenašiel</div>;
    }

    const plan = plany.find(p => p.id === session.planId);

    // Time calculations
    const endTs = session.endTs || session.startTs;
    const durationMs = endTs - session.startTs;
    const durationMinutes = Math.floor(durationMs / 1000 / 60);

    const logs = session.log || [];

    // Group logs by Set blocks to distinct rounds
    // Since logs are chronological, we can just iterate.
    // We visually separate when the "Set Context" changes.
    // Unfortunatelly older logs don't have 'setNazov' or 'roundIndex'. We handle gracefull fallback.

    return (
        <div className="safe-screen bg-slate-50 dark:bg-slate-900 transition-colors">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 p-4 pt-safe shadow-sm sticky top-0 z-10 flex items-center gap-4 transition-colors">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                    <ArrowLeft />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-bold text-lg text-slate-800 dark:text-white truncate">
                        {plan?.nazov || 'Detail Tréningu'}
                    </h1>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {format(session.startTs, 'HH:mm', { locale: sk })} - {format(endTs, 'HH:mm', { locale: sk })}
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors">
                        <Clock className="text-blue-500 mb-2" size={24} />
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{durationMinutes}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Minút</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors">
                        <Trophy className="text-yellow-500 mb-2" size={24} />
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{logs.length}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Cvikov</div>
                    </div>
                </div>

                {/* Date Info */}
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors">
                    <Calendar size={20} />
                    <span className="font-medium">
                        {format(session.startTs, 'dd. MMMM yyyy (EEEE)', { locale: sk })}
                    </span>
                </div>

                {/* Timeline / Exercise List */}
                <div>
                    <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 ml-1">Detailný Log</h2>
                    <div className="space-y-4">
                        {logs.map((log, index) => {
                            const cvik = cviky.find(c => c.id === log.exerciseId);
                            const prevLog = logs[index - 1];
                            const isHeldReps = log.typ === 'DRZANE_OPAKOVANIA' || log.holdSec !== undefined;
                            const isMetronome = log.typ === 'METRONOM' || log.metronomeSec !== undefined;
                            const isPhaseExercise = log.typ === 'FAZOVE' || Boolean(log.phaseDurationsSec?.length);

                            // Detect if this is a start of a new visual block (new Set name or new Round)
                            // Or simpler: just show headers when they change.
                            const showHeader = !prevLog ||
                                prevLog.setNazov !== log.setNazov ||
                                prevLog.roundIndex !== log.roundIndex;

                            const itemStart = log.timestamp;
                            const itemEnd = itemStart + log.durationMs;

                            return (
                                <div key={index}>
                                    {/* Set Header (Only if context changes) */}
                                    {showHeader && (
                                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black text-sm uppercase mb-2 mt-4 ml-1">
                                            <Layers size={14} className="text-blue-500" />
                                            <span>{log.setNazov || 'Séria'}</span>
                                            {(log.roundIndex && log.roundTotal) && (
                                                <span className="text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 rounded text-xs ml-2">
                                                    {log.roundIndex} / {log.roundTotal}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Exercise Card */}
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between relative overflow-hidden transition-colors">
                                        {/* Left Accent */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-600" />

                                        <div className="flex items-center gap-3 pl-2">
                                            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex flex-col items-center leading-tight">
                                                <span>{format(itemStart, 'HH:mm:ss')}</span>
                                                <span className="w-px h-2 bg-slate-200 dark:bg-slate-700 my-0.5"></span>
                                                <span>{format(itemEnd, 'HH:mm:ss')}</span>
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-slate-100 leading-tight">
                                                    {cvik?.nazov || log.exerciseName || 'Neznámy cvik'}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {isHeldReps
                                                        ? `${log.reps}x drž ${log.holdSec ?? 20}s · pauza ${log.restBetweenRepsSec ?? 0}s`
                                                        : isMetronome
                                                            ? `${log.reps}x · každé ${log.metronomeSec ?? 2}s`
                                                            : isPhaseExercise
                                                                ? `${log.reps}x · fázy ${(log.phaseDurationsSec ?? []).join('/')}s · pauza ${log.restBetweenRepsSec ?? 0}s`
                                                        : `${Math.round(log.durationMs / 1000)}s`}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right flex flex-col items-end">
                                            <div className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">
                                                {log.reps}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">
                                                {isHeldReps ? 'Držané' : isMetronome ? 'Metro.' : isPhaseExercise ? 'Fázy' : (log.reps > 20 && log.durationMs > 20000 ? 'Sek?' : 'Opak.')}
                                            </div>
                                            {log.vaha ? (
                                                <div className="text-xs font-bold text-blue-500 mt-0.5">
                                                    {log.vaha} kg
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
