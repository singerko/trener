export type CvikType = 'POCTOVY' | 'CASOVY' | 'DRZANE_OPAKOVANIA' | 'METRONOM';
export type SetType = 'NORMAL' | 'ROZCVICKA';
export type InputMode = 'VOICE' | 'BUTTON' | 'MIXED';

// --- CORE ENTITIES ---

export interface Cvik {
    id: string;
    nazov: string;
    popis: string;
    // Removed type/defaults as per user request
}

export interface SetItem {
    id: string;
    cvik_id: string;
    typ: CvikType; // Type is now determined per-usage
    ciel: number;  // Unified target value (reps or seconds)
    vaha?: number; // Weight in kg (optional)
    holdSec?: number;
    restBetweenRepsSec?: number;
    restAfterSec?: number;
    metronomeSec?: number;
}

export interface SetBlock {
    id: string;
    nazov: string; // e.g. "Rozcvička", "Nohy A", "Ruky"
    typ: SetType;
    opakovania: number; // How many times this set repeats
    polozky: SetItem[];
}

export interface WorkoutPlan {
    id: string;
    nazov: string;
    sety: SetBlock[];
    createdAt: number;
}


// --- HISTORY / SESSION DATA ---

export interface WorkoutSession {
    id: string;
    planId: string;
    startTs: number;
    endTs?: number;
    mode: InputMode;
    log: ExerciseLog[];
}

export interface ExerciseLog {
    exerciseId: string;
    setId: string;
    setNazov?: string; // Snapshot of set name
    roundIndex?: number; // 1-based index of the round
    roundTotal?: number; // Total rounds in set
    timestamp: number;
    reps: number;
    vaha?: number; // Snapshot of weight used
    typ?: CvikType;
    holdSec?: number;
    restBetweenRepsSec?: number;
    restAfterSec?: number;
    metronomeSec?: number;
    completedHeldReps?: number;
    durationMs: number;
    events: RepEvent[];
}

export interface RehabEvent {
    id: string;
    scheduledTs: number;
    description: string;
    createdAt: number;
}

export interface RepEvent {
    value: number; // e.g. 1, 2, 3...
    ts: number;
    source: 'VOICE' | 'BUTTON';
}

export type ThemeType = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface AppSettings {
    voiceControlEnabled: boolean;
    ttsEnabled: boolean;
    theme: ThemeType;
}
