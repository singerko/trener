import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cvik, WorkoutPlan, WorkoutSession, AppSettings, RehabEvent, MeasurementDefinition, MeasurementEntry, MeasurementNotePreset } from './types';
import { importWorkoutPackageIntoState } from './workoutTransfer';
import type { ImportWorkoutResult, WorkoutExportPackage } from './workoutTransfer';

interface TrenerState {
    cviky: Cvik[];
    plany: WorkoutPlan[];
    history: WorkoutSession[];
    rehabEvents: RehabEvent[];
    measurementDefinitions: MeasurementDefinition[];
    measurementEntries: MeasurementEntry[];

    // Actions
    addCvik: (cvik: Cvik) => void;
    updateCvik: (id: string, data: Partial<Cvik>) => void;
    deleteCvik: (id: string) => void;

    addPlan: (plan: WorkoutPlan) => void;
    updatePlan: (id: string, data: Partial<WorkoutPlan>) => void;
    deletePlan: (id: string) => void;
    movePlan: (id: string, direction: -1 | 1) => void;
    importWorkoutPackage: (payload: WorkoutExportPackage) => ImportWorkoutResult;

    addSession: (session: WorkoutSession) => void;
    addRehabEvent: (event: RehabEvent) => void;
    addMeasurementDefinition: (definition: MeasurementDefinition) => void;
    updateMeasurementDefinition: (id: string, data: Partial<MeasurementDefinition>) => void;
    archiveMeasurementDefinition: (id: string) => void;
    addMeasurementEntry: (entry: MeasurementEntry) => void;
    updateMeasurementEntry: (id: string, data: Partial<MeasurementEntry>) => void;
    deleteMeasurementEntry: (id: string) => void;
    upsertMeasurementNotePreset: (definitionId: string, preset: Omit<MeasurementNotePreset, 'id'> & { id?: string }) => void;
    resetAll: () => void;

    // Settings
    settings: AppSettings;
    toggleVoiceControl: () => void;
    toggleTTS: () => void;
    setTheme: (theme: AppSettings['theme']) => void;
}

const DEFAULT_CVIKY: Cvik[] = [
    { id: 'c1', nazov: 'Drepy', popis: 'Klasické drepy s vlastnou váhou' },
    { id: 'c2', nazov: 'Kľuky', popis: 'Kliky na zemi' },
    { id: 'c3', nazov: 'Plank', popis: 'Výdrž v doske' },
    { id: 'c4', nazov: 'Jumping Jacks', popis: 'Skákanie panák' },
    { id: 'c5', nazov: 'Výpady', popis: 'Výpady vpred striedavo nohy' },
];

export const useStore = create<TrenerState>()(
    persist(
        (set) => ({
            cviky: DEFAULT_CVIKY,
            plany: [],
            history: [],
            rehabEvents: [],
            measurementDefinitions: [],
            measurementEntries: [],
            settings: { voiceControlEnabled: false, ttsEnabled: true, theme: 'SYSTEM' },

            addCvik: (cvik) => set((state) => ({ cviky: [...state.cviky, cvik] })),
            updateCvik: (id, data) => set((state) => ({
                cviky: state.cviky.map((c) => (c.id === id ? { ...c, ...data } : c)),
            })),
            deleteCvik: (id) => set((state) => ({
                cviky: state.cviky.filter((c) => c.id !== id),
            })),

            addPlan: (plan) => set((state) => ({ plany: [...state.plany, plan] })),
            updatePlan: (id, data) => set((state) => ({
                plany: state.plany.map((p) => (p.id === id ? { ...p, ...data } : p)),
            })),
            deletePlan: (id) => set((state) => ({
                plany: state.plany.filter((p) => p.id !== id),
            })),
            movePlan: (id, direction) => set((state) => {
                const index = state.plany.findIndex((plan) => plan.id === id);
                const targetIndex = index + direction;
                if (index === -1 || targetIndex < 0 || targetIndex >= state.plany.length) {
                    return { plany: state.plany };
                }

                const plany = [...state.plany];
                [plany[index], plany[targetIndex]] = [plany[targetIndex], plany[index]];
                return { plany };
            }),
            importWorkoutPackage: (payload) => {
                let result: ImportWorkoutResult | null = null;
                set((state) => {
                    result = importWorkoutPackageIntoState(payload, state);
                    return { cviky: result.cviky, plany: result.plany };
                });
                if (!result) throw new Error('Import tréningu zlyhal');
                return result;
            },

            addSession: (session) => set((state) => ({ history: [...state.history, session] })),
            addRehabEvent: (event) => set((state) => ({ rehabEvents: [...state.rehabEvents, event] })),
            addMeasurementDefinition: (definition) => set((state) => ({
                measurementDefinitions: [...state.measurementDefinitions, definition],
            })),
            updateMeasurementDefinition: (id, data) => set((state) => ({
                measurementDefinitions: state.measurementDefinitions.map((definition) => (
                    definition.id === id
                        ? { ...definition, ...data, updatedAt: Date.now() }
                        : definition
                )),
            })),
            archiveMeasurementDefinition: (id) => set((state) => ({
                measurementDefinitions: state.measurementDefinitions.map((definition) => (
                    definition.id === id
                        ? { ...definition, archivedAt: Date.now(), updatedAt: Date.now() }
                        : definition
                )),
            })),
            addMeasurementEntry: (entry) => set((state) => ({
                measurementEntries: [...state.measurementEntries, entry],
            })),
            updateMeasurementEntry: (id, data) => set((state) => ({
                measurementEntries: state.measurementEntries.map((entry) => (
                    entry.id === id
                        ? { ...entry, ...data, updatedAt: Date.now() }
                        : entry
                )),
            })),
            deleteMeasurementEntry: (id) => set((state) => ({
                measurementEntries: state.measurementEntries.filter((entry) => entry.id !== id),
            })),
            upsertMeasurementNotePreset: (definitionId, preset) => set((state) => ({
                measurementDefinitions: state.measurementDefinitions.map((definition) => {
                    if (definition.id !== definitionId) return definition;
                    const text = preset.text.trim();
                    if (!text) return definition;

                    const existingIndex = definition.notePresets.findIndex((item) => (
                        item.id === preset.id || item.text.toLocaleLowerCase('sk') === text.toLocaleLowerCase('sk')
                    ));
                    const notePreset: MeasurementNotePreset = {
                        id: preset.id ?? definition.notePresets[existingIndex]?.id ?? crypto.randomUUID(),
                        text,
                        color: preset.color,
                    };
                    const notePresets = existingIndex === -1
                        ? [...definition.notePresets, notePreset]
                        : definition.notePresets.map((item, index) => index === existingIndex ? notePreset : item);

                    return { ...definition, notePresets, updatedAt: Date.now() };
                }),
            })),

            resetAll: () => set({
                cviky: DEFAULT_CVIKY,
                plany: [],
                history: [],
                rehabEvents: [],
                measurementDefinitions: [],
                measurementEntries: [],
            }),

            toggleVoiceControl: () => set((state) => ({
                settings: { ...state.settings, voiceControlEnabled: !state.settings.voiceControlEnabled }
            })),

            toggleTTS: () => set((state) => ({
                settings: { ...state.settings, ttsEnabled: !state.settings.ttsEnabled }
            })),

            setTheme: (theme) => set((state) => ({
                settings: { ...state.settings, theme }
            }))
        }),
        {
            name: 'trener-storage',
        }
    )
);
