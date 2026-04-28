import type { WorkoutPlan } from './types';

const getRuntimePlanKey = (planId: string) => `trener-runtime-plan:${planId}`;

export const cloneWorkoutPlan = (plan: WorkoutPlan): WorkoutPlan => ({
    ...plan,
    sety: plan.sety.map((set) => ({
        ...set,
        polozky: set.polozky.map((item) => ({ ...item })),
    })),
});

export const saveRuntimeWorkoutPlan = (plan: WorkoutPlan) => {
    sessionStorage.setItem(getRuntimePlanKey(plan.id), JSON.stringify(cloneWorkoutPlan(plan)));
};

export const loadRuntimeWorkoutPlan = (planId: string): WorkoutPlan | null => {
    const raw = sessionStorage.getItem(getRuntimePlanKey(planId));
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as WorkoutPlan;
        return cloneWorkoutPlan(parsed);
    } catch {
        return null;
    }
};

export const clearRuntimeWorkoutPlan = (planId: string) => {
    sessionStorage.removeItem(getRuntimePlanKey(planId));
};
