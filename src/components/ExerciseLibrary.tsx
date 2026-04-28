import { useState } from 'react';
import { useStore } from '../lib/store';
import { Plus, Trash2, Edit2, X, Save } from 'lucide-react';
import type { Cvik } from '../lib/types';
// import { clsx } from 'clsx'; // Unused

export default function ExerciseLibrary() {
    const { cviky, addCvik, updateCvik, deleteCvik } = useStore();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Cvik>>({
        nazov: '',
        popis: ''
    });

    const resetForm = () => {
        setFormData({
            nazov: '',
            popis: ''
        });
        setEditingId(null);
        setIsCreating(false);
    };

    const handleEdit = (c: Cvik) => {
        setFormData(c);
        setEditingId(c.id);
        setIsCreating(false);
    };

    const handleSave = () => {
        if (!formData.nazov) return;

        if (editingId) {
            updateCvik(editingId, formData);
        } else {
            addCvik({
                id: crypto.randomUUID(),
                nazov: formData.nazov!,
                popis: formData.popis || ''
            } as Cvik);
        }
        resetForm();
    };

    const handleDelete = (id: string) => {
        if (confirm('Naozaj vymazať tento cvik?')) {
            deleteCvik(id);
        }
    };

    return (
        <div className="p-4 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Knižnica Cvikov</h1>
                {!isCreating && !editingId && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} /> Pridať
                    </button>
                )}
            </div>

            {/* Editor Form */}
            {(isCreating || editingId) && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border border-blue-100 dark:border-slate-700 mb-6 animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">{editingId ? 'Upraviť Cvik' : 'Nový Cvik'}</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Názov</label>
                            <input
                                className="w-full border dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                value={formData.nazov}
                                onChange={e => setFormData({ ...formData, nazov: e.target.value })}
                                placeholder="Napr. Drepy"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Popis (Voliteľné)</label>
                            <textarea
                                className="w-full border dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                value={formData.popis}
                                onChange={e => setFormData({ ...formData, popis: e.target.value })}
                                placeholder="Stručný popis techniky..."
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded-lg flex justify-center items-center gap-2 hover:bg-blue-700 font-medium transition-colors">
                                <Save size={18} /> Uložiť
                            </button>
                            <button onClick={resetForm} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg flex justify-center items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-600 font-medium transition-colors">
                                <X size={18} /> Zrušiť
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="grid gap-3">
                {cviky.length === 0 && <div className="text-center text-slate-500 dark:text-slate-400 py-8">Žiadne cviky v knižnici.</div>}

                {[...cviky].sort((a, b) => a.nazov.localeCompare(b.nazov, 'sk')).map(c => (
                    <div key={c.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-start transition-colors">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{c.nazov}</h3>
                            {c.popis && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{c.popis}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0 ml-4">
                            <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
