import { useState, useMemo, type ChangeEvent } from 'react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isToday,
    setYear,
    parse,
    isValid,
} from 'date-fns';
import { sk } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, ChevronRight as ChevronRightIcon, Plus, X, Ruler } from 'lucide-react';

export default function History() {
    const { history, plany, rehabEvents, addRehabEvent, measurementDefinitions, measurementEntries } = useStore();
    const navigate = useNavigate();

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showRehabForm, setShowRehabForm] = useState(false);
    const [rehabDate, setRehabDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [rehabTime, setRehabTime] = useState('09:00');
    const [rehabDescription, setRehabDescription] = useState('Rehabilitácia');

    // Generate Calendar Grid
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: sk });
    const endDate = endOfWeek(monthEnd, { locale: sk });

    const calendarDays = useMemo(() => {
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [startDate, endDate]);

    // Derived Data
    const sessionsOnSelectedDate = history.filter(s => isSameDay(new Date(s.startTs), selectedDate));
    const rehabEventsOnSelectedDate = rehabEvents
        .filter(event => isSameDay(new Date(event.scheduledTs), selectedDate))
        .sort((a, b) => a.scheduledTs - b.scheduledTs);
    const measurementEntriesOnSelectedDate = measurementEntries
        .filter(entry => isSameDay(new Date(entry.measuredAt), selectedDate))
        .sort((a, b) => a.measuredAt - b.measuredAt);

    // Check which days have workouts (for indicators)
    const activeDays = useMemo(() => {
        const titleSet = new Set<string>();
        history.forEach(s => {
            titleSet.add(format(new Date(s.startTs), 'yyyy-MM-dd'));
        });
        return titleSet;
    }, [history]);

    const hasWorkout = (date: Date) => activeDays.has(format(date, 'yyyy-MM-dd'));

    const rehabDays = useMemo(() => {
        const titleSet = new Set<string>();
        rehabEvents.forEach(event => {
            titleSet.add(format(new Date(event.scheduledTs), 'yyyy-MM-dd'));
        });
        return titleSet;
    }, [rehabEvents]);

    const hasRehab = (date: Date) => rehabDays.has(format(date, 'yyyy-MM-dd'));

    const measurementDays = useMemo(() => {
        const titleSet = new Set<string>();
        measurementEntries.forEach(entry => {
            titleSet.add(format(new Date(entry.measuredAt), 'yyyy-MM-dd'));
        });
        return titleSet;
    }, [measurementEntries]);

    const hasMeasurement = (date: Date) => measurementDays.has(format(date, 'yyyy-MM-dd'));

    const getMeasurementDefinition = (definitionId: string) => measurementDefinitions.find(definition => definition.id === definitionId);

    const getMeasurementNoteColor = (definitionId: string, note?: string) => {
        if (!note) return '#94a3b8';
        const definition = getMeasurementDefinition(definitionId);
        return definition?.notePresets.find(preset => preset.text.toLocaleLowerCase('sk') === note.toLocaleLowerCase('sk'))?.color ?? '#94a3b8';
    };

    // Handlers
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Year Selector logic (simple implementation)
    const handleYearChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const year = parseInt(e.target.value);
        setCurrentDate(setYear(currentDate, year));
    };

    const openRehabForm = () => {
        setRehabDate(format(selectedDate, 'yyyy-MM-dd'));
        setRehabTime('09:00');
        setRehabDescription('Rehabilitácia');
        setShowRehabForm(true);
    };

    const saveRehabEvent = () => {
        const scheduledAt = parse(`${rehabDate} ${rehabTime}`, 'yyyy-MM-dd HH:mm', new Date());
        const description = rehabDescription.trim() || 'Rehabilitácia';

        if (!isValid(scheduledAt)) {
            alert('Zadaj platný dátum a čas rehabilitácie');
            return;
        }

        addRehabEvent({
            id: crypto.randomUUID(),
            scheduledTs: scheduledAt.getTime(),
            description,
            createdAt: Date.now(),
        });

        setSelectedDate(scheduledAt);
        setCurrentDate(scheduledAt);
        setShowRehabForm(false);
    };

    const currentYear = currentDate.getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

    return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex flex-col transition-colors">
            <div className="p-4 max-w-md mx-auto w-full">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">História</h1>

                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={prevMonth} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2 font-bold text-lg text-slate-800 dark:text-white uppercase">
                        <span>{format(currentDate, 'LLLL', { locale: sk })}</span>
                        <select
                            value={currentYear}
                            onChange={handleYearChange}
                            className="bg-transparent border-none p-0 font-bold text-slate-500 dark:text-slate-400 focus:ring-0 cursor-pointer appearance-none"
                        >
                            {years.map(y => <option key={y} value={y} className="text-slate-900 bg-white">{y}</option>)}
                        </select>
                    </div>
                    <button onClick={nextMonth} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-7 mb-2 text-center">
                    {['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map(day => (
                        <div key={day} className="text-xs font-bold text-slate-400 uppercase">{day}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-y-2">
                    {calendarDays.map((day, idx) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isTodayDate = isToday(day);
                        const hasWorkoutData = hasWorkout(day);
                        const hasRehabData = hasRehab(day);
                        const hasMeasurementData = hasMeasurement(day);

                        return (
                            <button
                                key={idx}
                                onClick={() => {
                                    setSelectedDate(day);
                                    if (!isCurrentMonth) setCurrentDate(day);
                                }}
                                className={`
                                    relative h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                                    ${!isCurrentMonth ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}
                                    ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
                                    ${isTodayDate && !isSelected ? 'border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : ''}
                                `}
                            >
                                {format(day, 'd')}
                                {/* Dot Indicator */}
                                {!isSelected && (hasWorkoutData || hasRehabData || hasMeasurementData) ? (
                                    <span className="absolute bottom-1 flex gap-0.5">
                                        {hasWorkoutData ? <span className="block w-1 h-1 bg-green-500 rounded-full" /> : null}
                                        {hasRehabData ? <span className="block w-1 h-1 bg-yellow-400 rounded-full" /> : null}
                                        {hasMeasurementData ? <span className="block w-1 h-1 bg-blue-500 rounded-full" /> : null}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Selected Date List */}
            <div className="flex-1 p-4 max-w-md mx-auto w-full">
                <div className="mb-4 space-y-3">
                    <h2 className="font-bold text-slate-500 dark:text-slate-400 uppercase text-sm">
                        {format(selectedDate, 'd. MMMM yyyy', { locale: sk })}
                    </h2>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-slate-200 dark:bg-slate-700 px-3 py-2">
                            <div className="text-base font-black leading-none text-slate-700 dark:text-slate-100">
                                {sessionsOnSelectedDate.length}
                            </div>
                            <div className="mt-1 text-[10px] font-black uppercase leading-tight text-slate-500 dark:text-slate-300">
                                Tréningov
                            </div>
                        </div>
                        <div className="rounded-xl bg-yellow-100 dark:bg-yellow-900/30 px-3 py-2">
                            <div className="text-base font-black leading-none text-yellow-700 dark:text-yellow-300">
                                {rehabEventsOnSelectedDate.length}
                            </div>
                            <div className="mt-1 text-[10px] font-black uppercase leading-tight text-yellow-700 dark:text-yellow-300">
                                Rehabilitácií
                            </div>
                        </div>
                        <div className="rounded-xl bg-blue-100 dark:bg-blue-900/30 px-3 py-2">
                            <div className="text-base font-black leading-none text-blue-700 dark:text-blue-300">
                                {measurementEntriesOnSelectedDate.length}
                            </div>
                            <div className="mt-1 text-[10px] font-black uppercase leading-tight text-blue-700 dark:text-blue-300">
                                Meraní
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/merania')}
                            className="flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-sm active:scale-95 transition-transform"
                        >
                            <Ruler size={14} /> Merania
                        </button>
                        <button
                            type="button"
                            onClick={openRehabForm}
                            className="flex items-center justify-center gap-1 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-black text-slate-900 shadow-sm active:scale-95 transition-transform"
                        >
                            <Plus size={14} /> Pridať
                        </button>
                    </div>
                </div>

                {showRehabForm ? (
                    <div className="mb-4 rounded-xl border border-yellow-200 dark:border-yellow-900/60 bg-yellow-50 dark:bg-yellow-950/20 p-3 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-xs font-black uppercase text-yellow-700 dark:text-yellow-300">
                                Nová rehabilitácia
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRehabForm(false)}
                                className="rounded-full p-1 text-yellow-700 dark:text-yellow-300"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label>
                                <span className="text-[10px] font-black uppercase text-yellow-700 dark:text-yellow-300">Deň</span>
                                <input
                                    type="date"
                                    value={rehabDate}
                                    onChange={e => setRehabDate(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-yellow-200 dark:border-yellow-800 bg-white dark:bg-slate-900 p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-yellow-500"
                                />
                            </label>
                            <label>
                                <span className="text-[10px] font-black uppercase text-yellow-700 dark:text-yellow-300">Čas</span>
                                <input
                                    type="time"
                                    value={rehabTime}
                                    onChange={e => setRehabTime(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-yellow-200 dark:border-yellow-800 bg-white dark:bg-slate-900 p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-yellow-500"
                                />
                            </label>
                        </div>
                        <label className="mt-2 block">
                            <span className="text-[10px] font-black uppercase text-yellow-700 dark:text-yellow-300">Popis</span>
                            <input
                                type="text"
                                value={rehabDescription}
                                onChange={e => setRehabDescription(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-yellow-200 dark:border-yellow-800 bg-white dark:bg-slate-900 p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-yellow-500"
                                placeholder="Rehabilitácia"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={saveRehabEvent}
                            className="mt-3 w-full rounded-lg bg-yellow-400 py-2 text-sm font-black text-slate-900 active:scale-[0.99] transition-transform"
                        >
                            Uložiť záznam
                        </button>
                    </div>
                ) : null}

                <div className="space-y-3">
                    {rehabEventsOnSelectedDate.map(event => (
                        <div
                            key={event.id}
                            className="w-full bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-xl shadow-sm border border-yellow-100 dark:border-yellow-900/60 flex items-center justify-between text-left"
                        >
                            <div>
                                <div className="font-bold text-slate-800 dark:text-white text-lg">{event.description}</div>
                                <div className="flex items-center gap-1 text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                    <Clock size={14} />
                                    {format(event.scheduledTs, 'HH:mm')}
                                </div>
                            </div>
                            <CalendarIcon size={20} className="text-yellow-500" />
                        </div>
                    ))}

                    {measurementEntriesOnSelectedDate.map(entry => {
                        const definition = getMeasurementDefinition(entry.definitionId);
                        const activeFields = definition?.fields.filter(field => !field.archivedAt) ?? [];
                        const valuesText = activeFields
                            .map(field => entry.values[field.id] === undefined ? null : `${field.name}: ${entry.values[field.id]} ${definition?.unit ?? ''}`)
                            .filter(Boolean)
                            .join(' · ');

                        return (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => navigate(`/merania/${entry.definitionId}`)}
                                className="w-full bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/60 flex items-center justify-between gap-3 text-left active:scale-[0.98] transition-all"
                            >
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 dark:text-white text-lg">{definition?.name ?? 'Meranie'}</div>
                                    <div className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                                        {format(entry.measuredAt, 'HH:mm')}
                                    </div>
                                    {valuesText ? (
                                        <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{valuesText}</div>
                                    ) : null}
                                    {entry.note ? (
                                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-slate-900/70 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getMeasurementNoteColor(entry.definitionId, entry.note) }} />
                                            {entry.note}
                                        </div>
                                    ) : null}
                                </div>
                                <Ruler size={20} className="shrink-0 text-blue-500" />
                            </button>
                        );
                    })}

                    {sessionsOnSelectedDate.length === 0 && rehabEventsOnSelectedDate.length === 0 && measurementEntriesOnSelectedDate.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                            V tento deň nemáš tréning, rehabilitáciu ani meranie.
                        </div>
                    ) : (
                        sessionsOnSelectedDate.map(session => {
                            const plan = plany.find(p => p.id === session.planId);
                            const duration = (session.endTs || session.startTs) - session.startTs;
                            const durationMin = Math.round(duration / 1000 / 60);

                            return (
                                <button
                                    key={session.id}
                                    onClick={() => navigate(`/historia/${session.id}`)}
                                    className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between text-left active:scale-[0.98] transition-all"
                                >
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white text-lg">{plan?.nazov || 'Tréning'}</div>
                                        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            <div className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {durationMin} min
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <CalendarIcon size={14} />
                                                {format(session.startTs, 'HH:mm')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-slate-300 dark:text-slate-600">
                                        <ChevronRightIcon />
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
