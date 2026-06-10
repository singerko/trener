import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDays, endOfDay, format, isValid, parse, startOfDay, subDays, subMonths, subYears } from 'date-fns';
import { sk } from 'date-fns/locale';
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, ChevronRight, Palette, Plus, Save, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../lib/store';
import type { MeasurementDefinition, MeasurementEntry, MeasurementField } from '../lib/types';

type RangeKey = '1d' | '1w' | '1m' | '6m' | '1y';

type DefinitionDraft = {
    name: string;
    unit: string;
    fields: MeasurementField[];
};

const NOTE_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed', '#0891b2', '#ea580c', '#64748b'];

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
    { key: '1d', label: '1 deň' },
    { key: '1w', label: '1 týždeň' },
    { key: '1m', label: '1 mesiac' },
    { key: '6m', label: '6 mes.' },
    { key: '1y', label: '1 rok' },
];

const createField = (name = ''): MeasurementField => ({
    id: crypto.randomUUID(),
    name,
});

const createDraft = (definition?: MeasurementDefinition): DefinitionDraft => ({
    name: definition?.name ?? '',
    unit: definition?.unit ?? '',
    fields: definition?.fields.filter(field => !field.archivedAt).map(field => ({ ...field })) ?? [createField('')],
});

const parseDecimal = (value: string, fieldName: string) => {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
        alert(`${fieldName} musí byť číslo`);
        return null;
    }
    return parsed;
};

const formatValue = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

const getRangeStart = (range: RangeKey, referenceDate: Date) => {
    if (range === '1d') return startOfDay(referenceDate);
    if (range === '1w') return subDays(referenceDate, 6);
    if (range === '1m') return subMonths(referenceDate, 1);
    if (range === '6m') return subMonths(referenceDate, 6);
    return subYears(referenceDate, 1);
};

const getNoteColor = (definition: MeasurementDefinition, note?: string) => {
    if (!note) return '#94a3b8';
    return definition.notePresets.find(preset => preset.text.toLocaleLowerCase('sk') === note.toLocaleLowerCase('sk'))?.color ?? '#94a3b8';
};

function MeasurementChart({
    definition,
    field,
    entries,
}: {
    definition: MeasurementDefinition;
    field: MeasurementField;
    entries: MeasurementEntry[];
}) {
    const points = entries
        .filter(entry => typeof entry.values[field.id] === 'number')
        .map(entry => ({
            entry,
            value: entry.values[field.id],
            ts: entry.measuredAt,
            color: getNoteColor(definition, entry.note),
        }))
        .sort((a, b) => a.ts - b.ts);

    if (points.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <h3 className="font-black text-slate-800 dark:text-white">{field.name}</h3>
                <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Bez hodnôt v tomto rozsahu.</div>
            </div>
        );
    }

    const minTs = Math.min(...points.map(point => point.ts));
    const maxTs = Math.max(...points.map(point => point.ts));
    const minValue = Math.min(...points.map(point => point.value));
    const maxValue = Math.max(...points.map(point => point.value));
    const valuePadding = Math.max((maxValue - minValue) * 0.12, 1);
    const low = minValue - valuePadding;
    const high = maxValue + valuePadding;
    const width = 320;
    const height = 170;
    const padLeft = 42;
    const padRight = 14;
    const padTop = 18;
    const padBottom = 32;
    const chartWidth = width - padLeft - padRight;
    const chartHeight = height - padTop - padBottom;

    const xFor = (ts: number) => {
        if (maxTs === minTs) return padLeft + chartWidth / 2;
        return padLeft + ((ts - minTs) / (maxTs - minTs)) * chartWidth;
    };
    const yFor = (value: number) => padTop + ((high - value) / (high - low)) * chartHeight;
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.ts).toFixed(1)} ${yFor(point.value).toFixed(1)}`).join(' ');

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-black text-slate-800 dark:text-white">{field.name}</h3>
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500">{points.length} bodov</div>
                </div>
                <div className="text-right text-xs font-bold text-slate-400 dark:text-slate-500">
                    <div>{formatValue(maxValue)} {definition.unit}</div>
                    <div>{formatValue(minValue)} {definition.unit}</div>
                </div>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible">
                <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + chartHeight} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                <line x1={padLeft} y1={padTop + chartHeight} x2={width - padRight} y2={padTop + chartHeight} stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                {[0, 0.5, 1].map(step => {
                    const value = high - (high - low) * step;
                    const y = padTop + chartHeight * step;
                    return (
                        <g key={step}>
                            <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-700/60" />
                            <text x={padLeft - 7} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-bold">
                                {formatValue(value)}
                            </text>
                        </g>
                    );
                })}
                {points.length > 1 ? <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600" /> : null}
                {points.map(point => (
                    <g key={point.entry.id}>
                        <title>{`${format(point.ts, 'd.M. HH:mm')} - ${formatValue(point.value)} ${definition.unit}${point.entry.note ? ` (${point.entry.note})` : ''}`}</title>
                        <circle cx={xFor(point.ts)} cy={yFor(point.value)} r="5" fill={point.color} stroke="white" strokeWidth="2" />
                    </g>
                ))}
                <text x={padLeft} y={height - 8} className="fill-slate-400 text-[10px] font-bold">
                    {format(minTs, 'd.M.')}
                </text>
                <text x={width - padRight} y={height - 8} textAnchor="end" className="fill-slate-400 text-[10px] font-bold">
                    {format(maxTs, 'd.M.')}
                </text>
            </svg>
        </div>
    );
}

export default function Measurements() {
    const { id } = useParams();
    const navigate = useNavigate();
    const {
        measurementDefinitions,
        measurementEntries,
        addMeasurementDefinition,
        updateMeasurementDefinition,
        archiveMeasurementDefinition,
        addMeasurementEntry,
        deleteMeasurementEntry,
        upsertMeasurementNotePreset,
    } = useStore();

    const activeDefinitions = measurementDefinitions.filter(definition => !definition.archivedAt);
    const selectedDefinition = id ? measurementDefinitions.find(definition => definition.id === id) : undefined;
    const [showDefinitionForm, setShowDefinitionForm] = useState(activeDefinitions.length === 0 && !id);
    const [editingDefinitionId, setEditingDefinitionId] = useState<string | null>(null);
    const [definitionDraft, setDefinitionDraft] = useState<DefinitionDraft>(() => createDraft());
    const [range, setRange] = useState<RangeKey>('1w');
    const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [entryTime, setEntryTime] = useState(format(new Date(), 'HH:mm'));
    const [entryValues, setEntryValues] = useState<Record<string, string>>({});
    const [entryNote, setEntryNote] = useState('');
    const [entryColor, setEntryColor] = useState(NOTE_COLORS[0]);

    const selectedEntries = useMemo(() => {
        if (!selectedDefinition) return [];
        return measurementEntries
            .filter(entry => entry.definitionId === selectedDefinition.id)
            .sort((a, b) => b.measuredAt - a.measuredAt);
    }, [measurementEntries, selectedDefinition]);

    const filteredEntries = useMemo(() => {
        const now = new Date();
        const start = getRangeStart(range, now).getTime();
        const end = range === '1d' ? endOfDay(now).getTime() : addDays(now, 1).getTime();
        return selectedEntries.filter(entry => entry.measuredAt >= start && entry.measuredAt <= end);
    }, [range, selectedEntries]);

    const activeFields = selectedDefinition?.fields.filter(field => !field.archivedAt) ?? [];
    const existingNote = selectedDefinition?.notePresets.find(preset => preset.text.toLocaleLowerCase('sk') === entryNote.trim().toLocaleLowerCase('sk'));

    const openNewDefinitionForm = () => {
        setEditingDefinitionId(null);
        setDefinitionDraft(createDraft());
        setShowDefinitionForm(true);
    };

    const openEditDefinitionForm = (definition: MeasurementDefinition) => {
        setEditingDefinitionId(definition.id);
        setDefinitionDraft(createDraft(definition));
        setShowDefinitionForm(true);
    };

    const saveDefinition = () => {
        const name = definitionDraft.name.trim();
        const unit = definitionDraft.unit.trim();
        const fields = definitionDraft.fields
            .map(field => ({ ...field, name: field.name.trim() }))
            .filter(field => field.name);

        if (!name) {
            alert('Zadaj názov merania');
            return;
        }
        if (!unit) {
            alert('Zadaj jednotku merania');
            return;
        }
        if (fields.length === 0) {
            alert('Zadaj aspoň jednu meranú položku');
            return;
        }

        const now = Number(new Date());
        if (editingDefinitionId) {
            const existing = measurementDefinitions.find(definition => definition.id === editingDefinitionId);
            const archivedFields = existing?.fields.filter(field => field.archivedAt || !fields.some(draftField => draftField.id === field.id)) ?? [];
            updateMeasurementDefinition(editingDefinitionId, {
                name,
                unit,
                fields: [
                    ...fields,
                    ...archivedFields.map(field => field.archivedAt ? field : { ...field, archivedAt: now }),
                ],
            });
        } else {
            const definition: MeasurementDefinition = {
                id: crypto.randomUUID(),
                name,
                unit,
                fields,
                notePresets: [],
                createdAt: now,
                updatedAt: now,
            };
            addMeasurementDefinition(definition);
            navigate(`/merania/${definition.id}`);
        }

        setShowDefinitionForm(false);
    };

    const saveEntry = () => {
        if (!selectedDefinition) return;
        const measuredAt = parse(`${entryDate} ${entryTime}`, 'yyyy-MM-dd HH:mm', new Date());
        if (!isValid(measuredAt)) {
            alert('Zadaj platný dátum a čas merania');
            return;
        }

        const values: Record<string, number> = {};
        for (const field of activeFields) {
            const parsed = parseDecimal(entryValues[field.id] ?? '', field.name);
            if (parsed === null) return;
            values[field.id] = parsed;
        }

        const note = entryNote.trim();
        if (note) {
            upsertMeasurementNotePreset(selectedDefinition.id, {
                text: note,
                color: existingNote?.color ?? entryColor,
            });
        }

        const now = measuredAt.getTime();
        addMeasurementEntry({
            id: crypto.randomUUID(),
            definitionId: selectedDefinition.id,
            measuredAt: measuredAt.getTime(),
            values,
            note: note || undefined,
            createdAt: now,
            updatedAt: now,
        });

        setEntryValues({});
        setEntryNote('');
        setEntryColor(NOTE_COLORS[0]);
    };

    const removeDefinition = (definition: MeasurementDefinition) => {
        if (!confirm(`Naozaj archivovať meranie "${definition.name}"? Historické záznamy zostanú uložené.`)) return;
        archiveMeasurementDefinition(definition.id);
        navigate('/merania');
    };

    if (!selectedDefinition) {
        return (
            <div className="safe-screen bg-slate-50 dark:bg-slate-900 transition-colors">
                <div className="mx-auto max-w-md p-4">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Merania</h1>
                            <div className="text-sm text-slate-500 dark:text-slate-400">Opuchy, tlak, hmotnosť a iné hodnoty</div>
                        </div>
                        <button
                            type="button"
                            onClick={openNewDefinitionForm}
                            className="rounded-full bg-blue-600 p-3 text-white shadow-sm active:scale-95 transition-transform"
                            aria-label="Nové meranie"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    {showDefinitionForm ? (
                        <DefinitionForm
                            draft={definitionDraft}
                            onDraftChange={setDefinitionDraft}
                            onSave={saveDefinition}
                            onClose={() => setShowDefinitionForm(false)}
                        />
                    ) : null}

                    <div className="space-y-3">
                        {activeDefinitions.map(definition => {
                            const entryCount = measurementEntries.filter(entry => entry.definitionId === definition.id).length;
                            return (
                                <Link
                                    key={definition.id}
                                    to={`/merania/${definition.id}`}
                                    className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm active:scale-[0.98] transition-transform"
                                >
                                    <div>
                                        <div className="font-black text-slate-800 dark:text-white">{definition.name}</div>
                                        <div className="mt-1 text-sm font-bold text-slate-400 dark:text-slate-500">
                                            {definition.fields.filter(field => !field.archivedAt).length} položiek · {entryCount} záznamov · {definition.unit}
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-300 dark:text-slate-600" />
                                </Link>
                            );
                        })}
                    </div>

                    {activeDefinitions.length === 0 && !showDefinitionForm ? (
                        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-400 dark:text-slate-500">
                            Zatiaľ nemáš vytvorené žiadne meranie.
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className="safe-screen bg-slate-50 dark:bg-slate-900 transition-colors">
            <div className="mx-auto max-w-md space-y-4 p-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/merania')}
                        className="rounded-full bg-white dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 shadow-sm"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-2xl font-bold text-slate-900 dark:text-white">{selectedDefinition.name}</h1>
                        <div className="text-sm font-bold text-slate-400 dark:text-slate-500">{selectedDefinition.unit}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => openEditDefinitionForm(selectedDefinition)}
                        className="rounded-full bg-slate-200 dark:bg-slate-700 p-2 text-slate-700 dark:text-slate-200"
                        aria-label="Upraviť meranie"
                    >
                        <Palette size={19} />
                    </button>
                </div>

                {showDefinitionForm ? (
                    <DefinitionForm
                        draft={definitionDraft}
                        onDraftChange={setDefinitionDraft}
                        onSave={saveDefinition}
                        onClose={() => setShowDefinitionForm(false)}
                        onArchive={() => removeDefinition(selectedDefinition)}
                    />
                ) : null}

                <div className="rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/20 p-4">
                    <div className="mb-3 text-xs font-black uppercase text-blue-700 dark:text-blue-300">Nový záznam</div>
                    <div className="grid grid-cols-2 gap-2">
                        <label>
                            <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300">Deň</span>
                            <input
                                type="date"
                                value={entryDate}
                                onChange={event => setEntryDate(event.target.value)}
                                className="mt-1 w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500"
                            />
                        </label>
                        <label>
                            <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300">Čas</span>
                            <input
                                type="time"
                                value={entryTime}
                                onChange={event => setEntryTime(event.target.value)}
                                className="mt-1 w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500"
                            />
                        </label>
                    </div>
                    <div className="mt-3 grid gap-2">
                        {activeFields.map(field => (
                            <label key={field.id}>
                                <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300">{field.name}</span>
                                <div className="mt-1 flex items-center overflow-hidden rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 focus-within:border-blue-500">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={entryValues[field.id] ?? ''}
                                        onChange={event => setEntryValues(values => ({ ...values, [field.id]: event.target.value }))}
                                        className="min-w-0 flex-1 bg-transparent p-3 text-lg font-black text-slate-800 dark:text-white outline-none"
                                    />
                                    <span className="px-3 text-sm font-black text-slate-400">{selectedDefinition.unit}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                    <label className="mt-3 block">
                        <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300">Poznámka</span>
                        <input
                            type="text"
                            list={`measurement-notes-${selectedDefinition.id}`}
                            value={entryNote}
                            onChange={event => {
                                const nextNote = event.target.value;
                                setEntryNote(nextNote);
                                const preset = selectedDefinition.notePresets.find(item => item.text.toLocaleLowerCase('sk') === nextNote.trim().toLocaleLowerCase('sk'));
                                if (preset) setEntryColor(preset.color);
                            }}
                            placeholder="ráno, po ľadovaní, po cvičení..."
                            className="mt-1 w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500"
                        />
                        <datalist id={`measurement-notes-${selectedDefinition.id}`}>
                            {selectedDefinition.notePresets.map(preset => <option key={preset.id} value={preset.text} />)}
                        </datalist>
                    </label>
                    {entryNote.trim() ? (
                        <div className="mt-3 flex items-center gap-2">
                            {NOTE_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setEntryColor(color)}
                                    className={clsx('h-8 w-8 rounded-full border-2', (existingNote?.color ?? entryColor) === color ? 'border-slate-900 dark:border-white' : 'border-white dark:border-slate-700')}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Farba ${color}`}
                                />
                            ))}
                        </div>
                    ) : null}
                    <button
                        type="button"
                        onClick={saveEntry}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-black text-white shadow-sm active:scale-[0.99] transition-transform"
                    >
                        <Save size={18} /> Uložiť meranie
                    </button>
                </div>

                <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm">
                    <div className="grid grid-cols-5 gap-1">
                        {RANGE_OPTIONS.map(option => (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => setRange(option.key)}
                                className={clsx('rounded-lg px-1 py-2 text-[11px] font-black transition-colors', range === option.key ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-400 dark:text-slate-500')}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {activeFields.map(field => (
                        <MeasurementChart
                            key={field.id}
                            definition={selectedDefinition}
                            field={field}
                            entries={filteredEntries}
                        />
                    ))}
                </div>

                <div>
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-400 dark:text-slate-500">
                        <BarChart3 size={16} /> Posledné záznamy
                    </h2>
                    <div className="space-y-2">
                        {selectedEntries.slice(0, 20).map(entry => (
                            <div key={entry.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-black text-slate-800 dark:text-white">{format(entry.measuredAt, 'd. MMMM HH:mm', { locale: sk })}</div>
                                        {entry.note ? (
                                            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getNoteColor(selectedDefinition, entry.note) }} />
                                                {entry.note}
                                            </div>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm('Vymazať tento záznam merania?')) deleteMeasurementEntry(entry.id);
                                        }}
                                        className="rounded-full p-2 text-slate-300 dark:text-slate-600"
                                        aria-label="Vymazať záznam"
                                    >
                                        <Trash2 size={17} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {activeFields.map(field => (
                                        <div key={field.id} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
                                            <div className="text-[10px] font-black uppercase text-slate-400">{field.name}</div>
                                            <div className="text-lg font-black text-slate-800 dark:text-white">
                                                {entry.values[field.id] === undefined ? '-' : formatValue(entry.values[field.id])} <span className="text-xs text-slate-400">{selectedDefinition.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    {selectedEntries.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-400 dark:text-slate-500">
                            Zatiaľ tu nie sú žiadne namerané hodnoty.
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function DefinitionForm({
    draft,
    onDraftChange,
    onSave,
    onClose,
    onArchive,
}: {
    draft: DefinitionDraft;
    onDraftChange: (draft: DefinitionDraft) => void;
    onSave: () => void;
    onClose: () => void;
    onArchive?: () => void;
}) {
    const updateField = (id: string, name: string) => {
        onDraftChange({
            ...draft,
            fields: draft.fields.map(field => field.id === id ? { ...field, name } : field),
        });
    };

    const moveField = (index: number, direction: -1 | 1) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= draft.fields.length) return;

        const fields = [...draft.fields];
        [fields[index], fields[targetIndex]] = [fields[targetIndex], fields[index]];
        onDraftChange({ ...draft, fields });
    };

    return (
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">Konfigurácia merania</div>
                <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400">
                    <X size={18} />
                </button>
            </div>
            <label className="block">
                <span className="text-[10px] font-black uppercase text-slate-400">Názov</span>
                <input
                    type="text"
                    value={draft.name}
                    onChange={event => onDraftChange({ ...draft, name: event.target.value })}
                    placeholder="Hmotnosť"
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
            </label>
            <label className="mt-3 block">
                <span className="text-[10px] font-black uppercase text-slate-400">Jednotka</span>
                <input
                    type="text"
                    value={draft.unit}
                    onChange={event => onDraftChange({ ...draft, unit: event.target.value })}
                    placeholder="cm, kg, mmHg"
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
            </label>
            <div className="mt-3 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400">Merané položky</div>
                {draft.fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                        <div className="flex flex-col gap-1">
                            <button
                                type="button"
                                onClick={() => moveField(index, -1)}
                                disabled={index === 0}
                                className="flex h-6 w-8 items-center justify-center rounded bg-slate-100 text-slate-500 disabled:opacity-30 dark:bg-slate-700 dark:text-slate-300"
                                aria-label="Posunúť položku vyššie"
                            >
                                <ArrowUp size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => moveField(index, 1)}
                                disabled={index === draft.fields.length - 1}
                                className="flex h-6 w-8 items-center justify-center rounded bg-slate-100 text-slate-500 disabled:opacity-30 dark:bg-slate-700 dark:text-slate-300"
                                aria-label="Posunúť položku nižšie"
                            >
                                <ArrowDown size={14} />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={field.name}
                            onChange={event => updateField(field.id, event.target.value)}
                            placeholder={index === 0 ? 'pod kolenom' : 'ďalšia položka'}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500"
                        />
                        <button
                            type="button"
                            onClick={() => onDraftChange({ ...draft, fields: draft.fields.filter(item => item.id !== field.id) })}
                            className="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 text-slate-400"
                            aria-label="Odstrániť položku"
                        >
                            <Trash2 size={17} />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => onDraftChange({ ...draft, fields: [...draft.fields, createField()] })}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 py-3 text-sm font-black text-slate-500 dark:text-slate-400"
                >
                    <Plus size={17} /> Pridať položku
                </button>
            </div>
            <div className="mt-4 flex gap-2">
                {onArchive ? (
                    <button
                        type="button"
                        onClick={onArchive}
                        className="rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-3 font-black text-red-600 dark:text-red-300"
                    >
                        <Trash2 size={18} />
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={onSave}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-black text-white"
                >
                    <Save size={18} /> Uložiť
                </button>
            </div>
        </div>
    );
}
