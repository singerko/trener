import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Play } from 'lucide-react';
import { useStore } from '../lib/store';
import type { WorkoutPlan } from '../lib/types';
import PlanForm from './PlanForm';
import { cloneWorkoutPlan, saveRuntimeWorkoutPlan } from '../lib/workoutRuntime';
import { prepareWorkoutPlanForRun } from '../lib/workoutPlanValidation';
import { shareWorkoutPlan } from '../lib/workoutShare';

export default function WorkoutStartEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { plany, cviky } = useStore();
    const [plan, setPlan] = useState<WorkoutPlan | null>(null);
    const [transferMessage, setTransferMessage] = useState('');

    useEffect(() => {
        if (!id) return;
        const sourcePlan = plany.find((candidate) => candidate.id === id);
        setPlan(sourcePlan ? cloneWorkoutPlan(sourcePlan) : null);
    }, [id, plany]);

    const handleStart = () => {
        if (!plan) return;
        const result = prepareWorkoutPlanForRun(plan);
        if (result.error || !result.plan) {
            alert(result.error ?? 'Tréning sa nepodarilo spustiť');
            return;
        }

        saveRuntimeWorkoutPlan(result.plan);
        navigate(`/trening/${result.plan.id}?custom=1`);
    };

    const handleExport = async () => {
        if (!plan) return;
        const result = prepareWorkoutPlanForRun(plan);
        if (result.error || !result.plan) {
            alert(result.error ?? 'Tréning sa nepodarilo exportovať');
            return;
        }

        try {
            const transferMode = await shareWorkoutPlan(result.plan, cviky);
            setTransferMessage(
                transferMode === 'shared'
                    ? `Otvoril som zdieľanie tréningu "${result.plan.nazov}".`
                    : `Tréning "${result.plan.nazov}" bol exportovaný do súboru.`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Export tréningu zlyhal';
            alert(message);
        }
    };

    if (!plan) {
        return (
            <div className="p-4 min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Tréning sa nenašiel.
            </div>
        );
    }

    return (
        <PlanForm
            plan={plan}
            cviky={cviky}
            onPlanChange={setPlan}
            onBack={() => navigate('/')}
            onSubmit={handleStart}
            submitLabel="Spustiť upravený tréning"
            submitIcon={<Play fill="currentColor" />}
            headerEyebrow="Jednorazová úprava"
            titleReadOnly
            notice={(
                <div className="space-y-2">
                    <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-900 dark:text-blue-200">
                        <div className="flex items-start justify-between gap-3">
                            <div>Zmeny platia iba pre najbližšie spustenie tréningu. Pôvodný tréning sa neprepíše.</div>
                            <button
                                type="button"
                                onClick={handleExport}
                                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black uppercase text-white hover:bg-blue-500 active:scale-95 transition-all flex items-center gap-1"
                            >
                                <Download size={16} /> Export
                            </button>
                        </div>
                    </div>
                    {transferMessage && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
                            {transferMessage}
                        </div>
                    )}
                </div>
            )}
        />
    );
}
