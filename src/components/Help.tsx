import { Moon, Sun, Monitor, Mic, Volume2, type LucideIcon } from 'lucide-react';
import { useStore } from '../lib/store';
import type { ThemeType } from '../lib/types';
import SingerLandLogo from './SingerLandLogo';

function ThemeButton({
    value,
    label,
    icon: Icon,
    selected,
    onSelect
}: {
    value: ThemeType;
    label: string;
    icon: LucideIcon;
    selected: boolean;
    onSelect: (value: ThemeType) => void;
}) {
    return (
        <button
            onClick={() => onSelect(value)}
            className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${selected
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
        >
            <Icon size={20} className="mb-2" />
            <span className="text-xs font-medium">{label}</span>
        </button>
    );
}

export default function Help() {
    const version = __APP_VERSION__;
    const buildDate = new Date(__BUILD_DATE__).toLocaleString('sk-SK');
    const { settings, toggleVoiceControl, toggleTTS, setTheme } = useStore();

    return (
        <div className="p-4 max-w-md mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nastavenia</h1>

            {/* THEME SETTINGS */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Vzhľad</h3>
                <div className="flex gap-3">
                    <ThemeButton value="LIGHT" label="Svetlý" icon={Sun} selected={settings.theme === 'LIGHT'} onSelect={setTheme} />
                    <ThemeButton value="DARK" label="Tmavý" icon={Moon} selected={settings.theme === 'DARK'} onSelect={setTheme} />
                    <ThemeButton value="SYSTEM" label="Systém" icon={Monitor} selected={settings.theme === 'SYSTEM'} onSelect={setTheme} />
                </div>
            </div>

            {/* VOICE SETTINGS */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Hlas a Zvuk</h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                <Mic size={20} />
                            </div>
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Hlasové ovládanie</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Počúvať príkazy</div>
                            </div>
                        </div>
                        <button
                            onClick={toggleVoiceControl}
                            className={`w-12 h-7 rounded-full transition-colors relative ${settings.voiceControlEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.voiceControlEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-700" />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg">
                                <Volume2 size={20} />
                            </div>
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Hlasová odozva (TTS)</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Čítať inštrukcie</div>
                            </div>
                        </div>
                        <button
                            onClick={toggleTTS}
                            className={`w-12 h-7 rounded-full transition-colors relative ${settings.ttsEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.ttsEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* INFO APP */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center space-y-4">
                <div className="flex flex-col items-center gap-3">
                    <SingerLandLogo subtitle="TRENER" size="lg" centered />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Tvoj osobný AI asistent</p>
                </div>

                <div className="w-full border-t border-slate-100 dark:border-slate-700 my-4"></div>

                <div className="grid grid-cols-2 gap-4 w-full text-sm">
                    <div className="text-right text-slate-500 dark:text-slate-400">Verzia:</div>
                    <div className="text-left font-mono font-bold text-slate-700 dark:text-slate-200">{version}</div>

                    <div className="text-right text-slate-500 dark:text-slate-400">Build:</div>
                    <div className="text-left font-mono font-bold text-slate-700 dark:text-slate-200">{buildDate}</div>
                </div>
            </div>

            <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
                &copy; {new Date().getFullYear()} Core AI Project
            </div>
        </div>
    );
}
