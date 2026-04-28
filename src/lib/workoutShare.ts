import type { Cvik, WorkoutPlan } from './types';
import { canUseNativeWorkoutShare, shareWorkoutFile } from './nativeWorkoutShare';
import { createWorkoutExportPackage, serializeWorkoutExportPackage } from './workoutTransfer';

export const createWorkoutExportFileName = (planName: string) => {
    const slug = planName
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `trener-${slug || 'trening'}.json`;
};

const downloadFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

export const shareWorkoutPlan = async (plan: WorkoutPlan, cviky: Cvik[]) => {
    const fileName = createWorkoutExportFileName(plan.nazov);
    const content = serializeWorkoutExportPackage(createWorkoutExportPackage(plan, cviky));
    const title = `Tréning ${plan.nazov}`;
    const text = `Export tréningu ${plan.nazov}`;

    if (canUseNativeWorkoutShare()) {
        await shareWorkoutFile({ fileName, content, title, text });
        return 'shared';
    }

    const file = new File([content], fileName, { type: 'application/json' });

    if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return 'shared';
    }

    downloadFile(fileName, content);
    return 'downloaded';
};
