import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useStore } from '../lib/store';
import type { WorkoutPlan } from '../lib/types';
import PlanForm from './PlanForm';
import { cloneWorkoutPlan } from '../lib/workoutRuntime';
import { prepareWorkoutPlanForRun } from '../lib/workoutPlanValidation';

const createEmptyPlan = (): WorkoutPlan => ({
    id: crypto.randomUUID(),
    nazov: '',
    sety: [],
    createdAt: 0,
});

export default function PlanEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { plany, cviky, addPlan, updatePlan, deletePlan } = useStore();
    const [plan, setPlan] = useState<WorkoutPlan>(createEmptyPlan);

    useEffect(() => {
        if (id && id !== 'new') {
            const existing = plany.find(p => p.id === id);
            if (existing) setPlan(cloneWorkoutPlan(existing));
        }
    }, [id, plany]);

    const handleSave = () => {
        const result = prepareWorkoutPlanForRun(plan);
        if (result.error || !result.plan) {
            alert(result.error ?? 'Tréning sa nepodarilo uložiť');
            return;
        }

        if (id && id !== 'new') {
            updatePlan(id, result.plan);
        } else {
            addPlan(result.plan);
        }
        navigate('/');
    };

    const handleDelete = () => {
        if (confirm('Naozaj vymazať tento tréning?')) {
            if (id) deletePlan(id);
            navigate('/');
        }
    };

    return (
        <PlanForm
            plan={plan}
            cviky={cviky}
            onPlanChange={setPlan}
            onBack={() => navigate('/')}
            onSubmit={handleSave}
            submitLabel="Uložiť Tréning"
            submitIcon={<Save />}
            onDelete={id && id !== 'new' ? handleDelete : undefined}
        />
    );
}
