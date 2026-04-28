import type { Cvik, SetBlock, SetItem, WorkoutPlan } from './types';

export const WORKOUT_EXPORT_SCHEMA = 'sk.singerland.trener.workout';
export const WORKOUT_EXPORT_VERSION = 1;

export interface WorkoutExportPackage {
    schema: typeof WORKOUT_EXPORT_SCHEMA;
    version: typeof WORKOUT_EXPORT_VERSION;
    exportedAt: string;
    plan: WorkoutPlan;
    exercises: Cvik[];
}

export interface ImportWorkoutState {
    cviky: Cvik[];
    plany: WorkoutPlan[];
}

export interface ImportWorkoutResult {
    cviky: Cvik[];
    plany: WorkoutPlan[];
    planId: string;
    planName: string;
    mode: 'created' | 'updated';
    addedExercises: number;
    reusedExercises: number;
}

const normalizeName = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('sk');

const clonePlan = (plan: WorkoutPlan): WorkoutPlan => ({
    ...plan,
    sety: plan.sety.map((set) => ({
        ...set,
        polozky: set.polozky.map((item) => ({ ...item })),
    })),
});

const cloneExercise = (exercise: Cvik): Cvik => ({ ...exercise });

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const requireString = (value: unknown, field: string): string => {
    if (typeof value !== 'string') throw new Error(`Neplatný export: chýba ${field}`);
    return value;
};

const requireNumber = (value: unknown, field: string): number => {
    if (!isNumber(value)) throw new Error(`Neplatný export: chýba ${field}`);
    return value;
};

const parseExercise = (value: unknown): Cvik => {
    if (!isRecord(value)) throw new Error('Neplatný export: cvik má zlý formát');

    return {
        id: requireString(value.id, 'id cviku'),
        nazov: requireString(value.nazov, 'názov cviku').trim(),
        popis: typeof value.popis === 'string' ? value.popis : '',
    };
};

const parseItem = (value: unknown): SetItem => {
    if (!isRecord(value)) throw new Error('Neplatný export: položka setu má zlý formát');

    const typ = requireString(value.typ, 'typ cviku');
    if (typ !== 'POCTOVY' && typ !== 'CASOVY' && typ !== 'DRZANE_OPAKOVANIA') {
        throw new Error(`Neplatný export: neznámy typ cviku ${typ}`);
    }

    const item: SetItem = {
        id: requireString(value.id, 'id položky'),
        cvik_id: requireString(value.cvik_id, 'id cviku v položke'),
        typ,
        ciel: requireNumber(value.ciel, 'cieľ položky'),
    };

    if (isNumber(value.vaha)) item.vaha = value.vaha;
    if (isNumber(value.holdSec)) item.holdSec = value.holdSec;
    if (isNumber(value.restBetweenRepsSec)) item.restBetweenRepsSec = value.restBetweenRepsSec;
    if (isNumber(value.restAfterSec)) item.restAfterSec = value.restAfterSec;

    return item;
};

const parseSet = (value: unknown): SetBlock => {
    if (!isRecord(value)) throw new Error('Neplatný export: set má zlý formát');

    const typ = requireString(value.typ, 'typ setu');
    if (typ !== 'NORMAL' && typ !== 'ROZCVICKA') {
        throw new Error(`Neplatný export: neznámy typ setu ${typ}`);
    }
    if (!Array.isArray(value.polozky)) throw new Error('Neplatný export: set nemá položky');

    return {
        id: requireString(value.id, 'id setu'),
        nazov: requireString(value.nazov, 'názov setu').trim(),
        typ,
        opakovania: requireNumber(value.opakovania, 'počet opakovaní setu'),
        polozky: value.polozky.map(parseItem),
    };
};

const parsePlan = (value: unknown): WorkoutPlan => {
    if (!isRecord(value)) throw new Error('Neplatný export: tréning má zlý formát');
    if (!Array.isArray(value.sety)) throw new Error('Neplatný export: tréning nemá sety');

    const plan: WorkoutPlan = {
        id: requireString(value.id, 'id tréningu'),
        nazov: requireString(value.nazov, 'názov tréningu').trim(),
        sety: value.sety.map(parseSet),
        createdAt: requireNumber(value.createdAt, 'dátum tréningu'),
    };

    if (!plan.nazov) throw new Error('Neplatný export: tréning nemá názov');
    return plan;
};

export const createWorkoutExportPackage = (plan: WorkoutPlan, cviky: Cvik[]): WorkoutExportPackage => {
    const referencedIds = new Set<string>();
    plan.sety.forEach((set) => {
        set.polozky.forEach((item) => referencedIds.add(item.cvik_id));
    });

    return {
        schema: WORKOUT_EXPORT_SCHEMA,
        version: WORKOUT_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        plan: clonePlan(plan),
        exercises: cviky.filter((cvik) => referencedIds.has(cvik.id)).map(cloneExercise),
    };
};

export const serializeWorkoutExportPackage = (payload: WorkoutExportPackage) => {
    return JSON.stringify(payload, null, 2);
};

export const parseWorkoutExportPackage = (json: string): WorkoutExportPackage => {
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) throw new Error('Neplatný export: súbor nemá správny formát');
    if (parsed.schema !== WORKOUT_EXPORT_SCHEMA) throw new Error('Neplatný export: nepodporovaný typ súboru');
    if (parsed.version !== WORKOUT_EXPORT_VERSION) throw new Error('Neplatný export: nepodporovaná verzia súboru');
    if (!Array.isArray(parsed.exercises)) throw new Error('Neplatný export: chýbajú cviky');

    return {
        schema: WORKOUT_EXPORT_SCHEMA,
        version: WORKOUT_EXPORT_VERSION,
        exportedAt: requireString(parsed.exportedAt, 'dátum exportu'),
        plan: parsePlan(parsed.plan),
        exercises: parsed.exercises.map(parseExercise).filter((exercise) => exercise.nazov.length > 0),
    };
};

export const importWorkoutPackageIntoState = (
    payload: WorkoutExportPackage,
    state: ImportWorkoutState,
): ImportWorkoutResult => {
    const nextCviky = state.cviky.map(cloneExercise);
    const exerciseByName = new Map(nextCviky.map((cvik) => [normalizeName(cvik.nazov), cvik]));
    const exerciseIdMap = new Map<string, string>();
    let addedExercises = 0;
    let reusedExercises = 0;

    payload.exercises.forEach((exercise) => {
        const normalized = normalizeName(exercise.nazov);
        const existing = exerciseByName.get(normalized);

        if (existing) {
            exerciseIdMap.set(exercise.id, existing.id);
            reusedExercises += 1;
            return;
        }

        const imported: Cvik = {
            id: crypto.randomUUID(),
            nazov: exercise.nazov.trim(),
            popis: exercise.popis,
        };
        nextCviky.push(imported);
        exerciseByName.set(normalized, imported);
        exerciseIdMap.set(exercise.id, imported.id);
        addedExercises += 1;
    });

    const importedPlan = clonePlan(payload.plan);
    importedPlan.sety = importedPlan.sety.map((set) => ({
        ...set,
        id: crypto.randomUUID(),
        polozky: set.polozky.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
            cvik_id: exerciseIdMap.get(item.cvik_id) ?? item.cvik_id,
        })),
    }));

    const existingPlan = state.plany.find((plan) => normalizeName(plan.nazov) === normalizeName(importedPlan.nazov));
    const nextPlany = state.plany.map(clonePlan);

    if (existingPlan) {
        const updatedPlan: WorkoutPlan = {
            ...importedPlan,
            id: existingPlan.id,
            createdAt: existingPlan.createdAt || importedPlan.createdAt || Date.now(),
        };

        return {
            cviky: nextCviky,
            plany: nextPlany.map((plan) => (plan.id === existingPlan.id ? updatedPlan : plan)),
            planId: existingPlan.id,
            planName: updatedPlan.nazov,
            mode: 'updated',
            addedExercises,
            reusedExercises,
        };
    }

    const createdPlan: WorkoutPlan = {
        ...importedPlan,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
    };

    return {
        cviky: nextCviky,
        plany: [...nextPlany, createdPlan],
        planId: createdPlan.id,
        planName: createdPlan.nazov,
        mode: 'created',
        addedExercises,
        reusedExercises,
    };
};
