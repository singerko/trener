import { useState, type ReactNode } from 'react';
import { Plus, Save, Trash2, ArrowUp, ArrowDown, X, Clock, Dumbbell, Edit2, RotateCcw, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import type { Cvik, CvikType, SetBlock, SetItem, WorkoutPlan } from '../lib/types';

type ItemDraft = {
    cvikId: string;
    typ: CvikType;
    ciel: string;
    vaha: string;
    holdSec: string;
    restBetweenRepsSec: string;
    restAfterSec: string;
};

interface PlanFormProps {
    plan: WorkoutPlan;
    cviky: Cvik[];
    onPlanChange: (plan: WorkoutPlan) => void;
    onBack: () => void;
    onSubmit: () => void;
    submitLabel: string;
    submitIcon?: ReactNode;
    headerEyebrow?: string;
    notice?: ReactNode;
    onDelete?: () => void;
    titleReadOnly?: boolean;
}

const createItemDraft = (cvikId = ''): ItemDraft => ({
    cvikId,
    typ: 'POCTOVY',
    ciel: '10',
    vaha: '',
    holdSec: '20',
    restBetweenRepsSec: '5',
    restAfterSec: '0',
});

const typeMeta: Record<CvikType, { label: string; badge: string; unit: string }> = {
    POCTOVY: { label: 'Počty', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', unit: 'x' },
    CASOVY: { label: 'Čas', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', unit: 's' },
    DRZANE_OPAKOVANIA: { label: 'Držané', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', unit: 'x' },
};

export default function PlanForm({
    plan,
    cviky,
    onPlanChange,
    onBack,
    onSubmit,
    submitLabel,
    submitIcon = <Save />,
    headerEyebrow,
    notice,
    onDelete,
    titleReadOnly = false,
}: PlanFormProps) {
    const sortedCviky = [...cviky].sort((a, b) => a.nazov.localeCompare(b.nazov, 'sk'));
    const [addingToSetId, setAddingToSetId] = useState<string | null>(null);
    const [newItemDraft, setNewItemDraft] = useState<ItemDraft>(createItemDraft());
    const [editingItem, setEditingItem] = useState<{
        setId: string;
        itemId: string;
        draft: ItemDraft;
    } | null>(null);

    const setPlan = onPlanChange;

    const parsePositiveInt = (value: string, fieldName: string) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
            alert(`${fieldName} musí byť celé číslo väčšie ako 0`);
            return null;
        }
        return parsed;
    };

    const parseOptionalWeight = (value: string) => {
        if (value.trim() === '') return undefined;
        const parsed = Number.parseFloat(value.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed < 0) {
            alert('Váha musí byť nezáporné číslo');
            return null;
        }
        return parsed === 0 ? undefined : parsed;
    };

    const parseNonNegativeInt = (value: string, fieldName: string) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
            alert(`${fieldName} musí byť celé číslo aspoň 0`);
            return null;
        }
        return parsed;
    };

    const buildItemPayload = (draft: ItemDraft) => {
        const ciel = parsePositiveInt(draft.ciel, draft.typ === 'CASOVY' ? 'Trvanie' : 'Počet opakovaní');
        if (ciel === null) return null;
        const vaha = parseOptionalWeight(draft.vaha);
        if (vaha === null) return null;

        if (draft.typ !== 'DRZANE_OPAKOVANIA') {
            return { typ: draft.typ, ciel, cvik_id: draft.cvikId, vaha };
        }

        const holdSec = parsePositiveInt(draft.holdSec, 'Držať každé');
        if (holdSec === null) return null;
        const restBetweenRepsSec = parseNonNegativeInt(draft.restBetweenRepsSec, 'Pauza medzi opakovaniami');
        if (restBetweenRepsSec === null) return null;
        const restAfterSec = parseNonNegativeInt(draft.restAfterSec, 'Pauza po cviku');
        if (restAfterSec === null) return null;

        return {
            typ: draft.typ,
            ciel,
            cvik_id: draft.cvikId,
            vaha,
            holdSec,
            restBetweenRepsSec,
            restAfterSec,
        };
    };

    const updateDraftType = (draft: ItemDraft, typ: CvikType): ItemDraft => ({
        ...draft,
        typ,
        ciel: typ === 'CASOVY' ? (draft.ciel || '30') : (draft.ciel || '10'),
        holdSec: draft.holdSec || '20',
        restBetweenRepsSec: draft.restBetweenRepsSec || '5',
        restAfterSec: draft.restAfterSec || '0',
    });

    const addSet = (typ: 'NORMAL' | 'ROZCVICKA') => {
        const newSet: SetBlock = {
            id: crypto.randomUUID(),
            nazov: typ === 'ROZCVICKA' ? 'Rozcvička' : `Set ${plan.sety.filter(s => s.typ === 'NORMAL').length + 1}`,
            typ,
            opakovania: 1,
            polozky: [],
        };
        setPlan({ ...plan, sety: [...plan.sety, newSet] });
    };

    const removeSet = (setId: string) => {
        setPlan({ ...plan, sety: plan.sety.filter(s => s.id !== setId) });
    };

    const updateSet = (setId: string, data: Partial<SetBlock>) => {
        setPlan({ ...plan, sety: plan.sety.map(s => s.id === setId ? { ...s, ...data } : s) });
    };

    const moveSet = (index: number, direction: -1 | 1) => {
        const newSety = [...plan.sety];
        if (index + direction < 0 || index + direction >= newSety.length) return;
        [newSety[index], newSety[index + direction]] = [newSety[index + direction], newSety[index]];
        setPlan({ ...plan, sety: newSety });
    };

    const startAddingItem = (setId: string) => {
        setAddingToSetId(setId);
        setNewItemDraft(createItemDraft(cviky[0]?.id || ''));
        setEditingItem(null);
    };

    const commitAddItem = () => {
        if (!addingToSetId || !newItemDraft.cvikId) return;
        const payload = buildItemPayload(newItemDraft);
        if (!payload) return;

        const newItem: SetItem = {
            id: crypto.randomUUID(),
            ...payload,
        };

        const setIndex = plan.sety.findIndex(s => s.id === addingToSetId);
        if (setIndex === -1) return;

        const newSety = [...plan.sety];
        newSety[setIndex].polozky.push(newItem);
        setPlan({ ...plan, sety: newSety });
        setAddingToSetId(null);
    };

    const removeItem = (setId: string, itemId: string) => {
        const setIndex = plan.sety.findIndex(s => s.id === setId);
        if (setIndex === -1) return;

        const newSety = [...plan.sety];
        newSety[setIndex].polozky = newSety[setIndex].polozky.filter(i => i.id !== itemId);
        setPlan({ ...plan, sety: newSety });
    };

    const moveItem = (setId: string, itemIndex: number, direction: -1 | 1) => {
        const setIndex = plan.sety.findIndex(s => s.id === setId);
        if (setIndex === -1) return;

        const newSety = [...plan.sety];
        const newItems = [...newSety[setIndex].polozky];

        if (itemIndex + direction < 0 || itemIndex + direction >= newItems.length) return;

        [newItems[itemIndex], newItems[itemIndex + direction]] = [newItems[itemIndex + direction], newItems[itemIndex]];
        newSety[setIndex].polozky = newItems;
        setPlan({ ...plan, sety: newSety });
    };

    const startEditingItem = (setId: string, item: SetItem) => {
        setEditingItem({
            setId,
            itemId: item.id,
            draft: {
                typ: item.typ,
                ciel: String(item.ciel),
                cvikId: item.cvik_id,
                vaha: item.vaha === undefined ? '' : String(item.vaha),
                holdSec: item.holdSec === undefined ? '20' : String(item.holdSec),
                restBetweenRepsSec: item.restBetweenRepsSec === undefined ? '5' : String(item.restBetweenRepsSec),
                restAfterSec: item.restAfterSec === undefined ? '0' : String(item.restAfterSec),
            },
        });
        setAddingToSetId(null);
    };

    const commitEditItem = () => {
        if (!editingItem) return;
        const { setId, itemId, draft } = editingItem;
        const payload = buildItemPayload(draft);
        if (!payload) return;

        const setIndex = plan.sety.findIndex(s => s.id === setId);
        if (setIndex === -1) return;

        const newSety = [...plan.sety];
        newSety[setIndex].polozky = newSety[setIndex].polozky.map(item =>
            item.id === itemId
                ? { ...item, ...payload }
                : item
        );

        setPlan({ ...plan, sety: newSety });
        setEditingItem(null);
    };

    const renderTypeButton = (
        typ: CvikType,
        selected: boolean,
        onClick: () => void,
    ) => {
        const Icon = typ === 'CASOVY' ? Clock : typ === 'DRZANE_OPAKOVANIA' ? RotateCcw : Dumbbell;
        const activeClass = typ === 'CASOVY'
            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
            : typ === 'DRZANE_OPAKOVANIA'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';

        return (
            <button
                type="button"
                onClick={onClick}
                className={clsx("flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors", selected ? activeClass : 'text-slate-400')}
            >
                <Icon size={14} /> {typeMeta[typ].label}
            </button>
        );
    };

    const renderDraftFields = (draft: ItemDraft, onChange: (draft: ItemDraft) => void) => (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1 flex-1">
                    {renderTypeButton('POCTOVY', draft.typ === 'POCTOVY', () => onChange(updateDraftType(draft, 'POCTOVY')))}
                    {renderTypeButton('CASOVY', draft.typ === 'CASOVY', () => onChange(updateDraftType(draft, 'CASOVY')))}
                    {renderTypeButton('DRZANE_OPAKOVANIA', draft.typ === 'DRZANE_OPAKOVANIA', () => onChange(updateDraftType(draft, 'DRZANE_OPAKOVANIA')))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                        {draft.typ === 'CASOVY' ? 'Trvanie' : 'Opakovania'}
                    </span>
                    <input
                        type="number"
                        min="1"
                        placeholder={draft.typ === 'CASOVY' ? 'sekundy' : 'počet'}
                        className="mt-1 w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-center font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                        value={draft.ciel}
                        onChange={e => onChange({ ...draft, ciel: e.target.value })}
                    />
                </label>
                <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Váha</span>
                    <input
                        type="number"
                        min="0"
                        placeholder="kg"
                        className="mt-1 w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-center font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                        value={draft.vaha}
                        onChange={e => onChange({ ...draft, vaha: e.target.value })}
                    />
                </label>
            </div>

            {draft.typ === 'DRZANE_OPAKOVANIA' && (
                <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                            <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Držať</span>
                            <input
                                type="number"
                                min="1"
                                className="mt-1 w-full p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 outline-none focus:border-emerald-500 text-center font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                                value={draft.holdSec}
                                onChange={e => onChange({ ...draft, holdSec: e.target.value })}
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Pauza</span>
                            <input
                                type="number"
                                min="0"
                                className="mt-1 w-full p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 outline-none focus:border-emerald-500 text-center font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                                value={draft.restBetweenRepsSec}
                                onChange={e => onChange({ ...draft, restBetweenRepsSec: e.target.value })}
                            />
                        </label>
                    </div>
                    <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                        {draft.ciel || 0}x: drž {draft.holdSec || 0}s, pauza {draft.restBetweenRepsSec || 0}s
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="p-4 bg-slate-50 dark:bg-slate-900 min-h-screen pb-40 max-w-md mx-auto pt-safe transition-colors">
            <div className="flex justify-between items-center mb-6 gap-3">
                <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full">
                    <ChevronLeft size={28} />
                </button>
                <div className="flex-1 min-w-0">
                    {headerEyebrow ? (
                        <div className="text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-400">
                            {headerEyebrow}
                        </div>
                    ) : null}
                    {titleReadOnly ? (
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white truncate">{plan.nazov}</h1>
                    ) : (
                        <input
                            className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 outline-none w-full text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                            placeholder="Názov tréningu..."
                            value={plan.nazov}
                            onChange={e => setPlan({ ...plan, nazov: e.target.value })}
                        />
                    )}
                </div>
                <div className="flex gap-2">
                    {onDelete && (
                        <button onClick={onDelete} className="p-2 text-red-300 hover:text-red-600 transition-colors">
                            <Trash2 />
                        </button>
                    )}
                </div>
            </div>

            {notice ? <div className="mb-4">{notice}</div> : null}

            <div className="space-y-6">
                {plan.sety.map((set, setIndex) => (
                    <div key={set.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-2 flex-1">
                                <input
                                    className="font-bold bg-transparent outline-none w-32 md:w-auto text-slate-700 dark:text-slate-200"
                                    value={set.nazov}
                                    onChange={e => updateSet(set.id, { nazov: e.target.value })}
                                />
                                {set.typ === 'ROZCVICKA' && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">Rozcvička</span>}
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded p-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase px-1">Opakovať:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-8 text-center font-bold outline-none text-slate-800 dark:text-white bg-transparent"
                                        value={set.opakovania === 0 ? '' : set.opakovania}
                                        onChange={e => {
                                            const value = e.target.value;
                                            updateSet(set.id, { opakovania: value === '' ? 0 : Number.parseInt(value, 10) || 0 });
                                        }}
                                    />
                                    <span className="text-[10px] text-slate-400 font-bold">x</span>
                                </div>

                                <div className="flex">
                                    <button onClick={() => moveSet(setIndex, -1)} disabled={setIndex === 0} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-20"><ArrowUp size={16} /></button>
                                    <button onClick={() => moveSet(setIndex, 1)} disabled={setIndex === plan.sety.length - 1} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-20"><ArrowDown size={16} /></button>
                                </div>

                                <button onClick={() => removeSet(set.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-3 space-y-2">
                            {set.polozky.length === 0 && addingToSetId !== set.id && (
                                <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-lg">
                                    Žiadne cviky v tomto sete
                                </div>
                            )}

                            {set.polozky.map((item, itemIndex) => {
                                const cvik = cviky.find(c => c.id === item.cvik_id);
                                if (!cvik) return null;

                                const isEditing = editingItem?.itemId === item.id;

                                if (isEditing) {
                                    return (
                                        <div key={item.id} className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800 shadow-inner">
                                            <div className="space-y-3">
                                                <select
                                                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                                                    value={editingItem.draft.cvikId}
                                                    onChange={e => setEditingItem({ ...editingItem, draft: { ...editingItem.draft, cvikId: e.target.value } })}
                                                >
                                                    {sortedCviky.map(c => <option key={c.id} value={c.id}>{c.nazov}</option>)}
                                                </select>

                                                {renderDraftFields(editingItem.draft, draft => setEditingItem({ ...editingItem, draft }))}

                                                <div className="flex gap-2">
                                                    <button onClick={commitEditItem} className="flex-1 bg-slate-800 dark:bg-blue-600 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                                                        <Save size={14} /> OK
                                                    </button>
                                                    <button onClick={() => setEditingItem(null)} className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                                                        <RotateCcw size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm group">
                                        <div
                                            className="flex items-center gap-3 flex-1 cursor-pointer"
                                            onClick={() => startEditingItem(set.id, item)}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300">
                                                {itemIndex + 1}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                    {cvik.nazov}
                                                    <Edit2 size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={clsx("text-xs px-2 py-0.5 rounded font-medium", typeMeta[item.typ].badge)}>
                                                        {typeMeta[item.typ].label}
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                                        {item.ciel} {typeMeta[item.typ].unit}
                                                    </span>
                                                    {item.typ === 'DRZANE_OPAKOVANIA' ? (
                                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                                                            drž {item.holdSec ?? 20}s · pauza {item.restBetweenRepsSec ?? 0}s
                                                        </span>
                                                    ) : null}
                                                    {item.vaha ? (
                                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                            {item.vaha} kg
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col mr-2">
                                            <button onClick={() => moveItem(set.id, itemIndex, -1)} disabled={itemIndex === 0} className="p-1 text-slate-300 hover:text-blue-500 disabled:opacity-20"><ArrowUp size={14} /></button>
                                            <button onClick={() => moveItem(set.id, itemIndex, 1)} disabled={itemIndex === set.polozky.length - 1} className="p-1 text-slate-300 hover:text-blue-500 disabled:opacity-20"><ArrowDown size={14} /></button>
                                        </div>
                                        <button onClick={() => removeItem(set.id, item.id)} className="text-slate-300 hover:text-red-500 p-2">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                );
                            })}

                            {addingToSetId === set.id ? (
                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-blue-200 dark:border-blue-800 animate-in fade-in zoom-in-95">
                                    <div className="space-y-3">
                                        <select
                                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                                            value={newItemDraft.cvikId}
                                            onChange={e => setNewItemDraft({ ...newItemDraft, cvikId: e.target.value })}
                                        >
                                            {sortedCviky.map(c => <option key={c.id} value={c.id}>{c.nazov}</option>)}
                                        </select>

                                        {renderDraftFields(newItemDraft, setNewItemDraft)}

                                        <div className="flex gap-2">
                                            <button onClick={commitAddItem} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-sm">Pridať</button>
                                            <button onClick={() => setAddingToSetId(null)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-lg font-bold text-sm">Zrušiť</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => startAddingItem(set.id)}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-blue-500 hover:border-blue-200 dark:hover:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all font-medium text-sm flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} /> Pridať cvik
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex gap-4 justify-center pb-20">
                <button onClick={() => addSet('ROZCVICKA')} className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors shadow-sm">
                    <Plus size={16} /> Rozcvička
                </button>
                <button onClick={() => addSet('NORMAL')} className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors shadow-sm">
                    <Plus size={16} /> Set
                </button>
            </div>

            <div className="fixed left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 flex justify-center z-10 app-bottom-action transition-colors">
                <button onClick={onSubmit} className="w-full max-w-md bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-800 dark:hover:bg-blue-500 transform active:scale-95 transition-all">
                    {submitIcon} {submitLabel}
                </button>
            </div>
        </div>
    );
}
