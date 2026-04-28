import { Capacitor, registerPlugin } from '@capacitor/core';

interface ShareWorkoutOptions {
    fileName: string;
    content: string;
    title: string;
    text: string;
}

interface WorkoutSharePlugin {
    shareWorkout(options: ShareWorkoutOptions): Promise<{ uri?: string }>;
}

const WorkoutShare = registerPlugin<WorkoutSharePlugin>('WorkoutShare');

export const canUseNativeWorkoutShare = () => {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('WorkoutShare');
};

export const shareWorkoutFile = (options: ShareWorkoutOptions) => {
    return WorkoutShare.shareWorkout(options);
};
