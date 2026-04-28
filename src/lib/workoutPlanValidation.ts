import type { WorkoutPlan } from './types';

export const prepareWorkoutPlanForRun = (plan: WorkoutPlan): { plan?: WorkoutPlan; error?: string } => {
    if (!plan.nazov.trim()) return { error: 'Zadaj názov tréningu' };
    if (plan.sety.length === 0) return { error: 'Pridaj aspoň jeden set' };

    const invalidSet = plan.sety.find((set) => set.opakovania < 1);
    if (invalidSet) return { error: `Set "${invalidSet.nazov}" musí mať počet opakovaní väčší ako 0` };

    const validSety = plan.sety.filter((set) => set.polozky.length > 0);
    if (validSety.length === 0) return { error: 'Sety nemôžu byť prázdne' };

    return {
        plan: {
            ...plan,
            nazov: plan.nazov.trim(),
            createdAt: plan.createdAt || Date.now(),
            sety: validSety,
        },
    };
};
