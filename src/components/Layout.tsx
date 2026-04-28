import { Outlet, NavLink } from 'react-router-dom';
import { Home, Dumbbell, Calendar, HelpCircle, TrendingUp } from 'lucide-react';
import { useStore } from '../lib/store';
import { useEffect } from 'react';

export default function Layout() {
    const { settings } = useStore();
    const theme = settings.theme;

    useEffect(() => {
        const root = window.document.documentElement;

        const applyTheme = (isDark: boolean) => {
            if (isDark) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        if (theme === 'SYSTEM') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
            applyTheme(systemTheme.matches);

            const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
            systemTheme.addEventListener('change', listener);
            return () => systemTheme.removeEventListener('change', listener);
        } else {
            applyTheme(theme === 'DARK');
        }
    }, [theme]);

    return (
        <div className="safe-screen bg-neutral-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 with-bottom-nav transition-colors duration-200">
            <main>
                <Outlet />
            </main>

            <nav className="fixed left-0 right-0 bg-white dark:bg-slate-950 border-t border-neutral-200 dark:border-slate-800 flex justify-around px-3 pt-3 z-50 app-bottom-nav text-xs font-medium">
                <NavLink to="/" className={({ isActive }) => `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-slate-500'}`}>
                    <Home size={24} />
                    <span className="uppercase">Domov</span>
                </NavLink>
                <NavLink to="/cviky" className={({ isActive }) => `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-slate-500'}`}>
                    <Dumbbell size={24} />
                    <span className="uppercase">Cviky</span>
                </NavLink>
                <NavLink to="/historia" className={({ isActive }) => `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-slate-500'}`}>
                    <Calendar size={24} />
                    <span className="uppercase">História</span>
                </NavLink>
                <NavLink to="/progres" className={({ isActive }) => `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-slate-500'}`}>
                    <TrendingUp size={24} />
                    <span className="uppercase">Progres</span>
                </NavLink>
                <NavLink to="/help" className={({ isActive }) => `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-slate-500'}`}>
                    <HelpCircle size={24} />
                    <span className="uppercase">Info</span>
                </NavLink>
            </nav>
        </div>
    );
}
