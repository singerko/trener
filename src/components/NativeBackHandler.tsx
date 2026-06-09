import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

declare global {
    interface Window {
        TrenerBack?: {
            handle: () => boolean;
        };
        TrenerConfirmWorkoutExit?: () => boolean;
    }
}

const getParentRoute = (pathname: string) => {
    if (pathname === '/') return null;
    if (pathname === '/cviky' || pathname === '/historia' || pathname === '/merania' || pathname === '/progres' || pathname === '/help') return '/';
    if (pathname.startsWith('/historia/')) return '/historia';
    if (pathname.startsWith('/merania/')) return '/merania';
    if (pathname.startsWith('/start/')) return '/';
    if (pathname.startsWith('/editor/')) return '/';
    if (pathname.startsWith('/trening/')) return '/';
    return '/';
};

export default function NativeBackHandler() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        window.TrenerBack = {
            handle: () => {
                if (location.pathname.startsWith('/trening/') && window.TrenerConfirmWorkoutExit) {
                    return window.TrenerConfirmWorkoutExit();
                }

                const parentRoute = getParentRoute(location.pathname);
                if (!parentRoute) return false;

                navigate(parentRoute, { replace: true });
                return true;
            },
        };

        return () => {
            delete window.TrenerBack;
        };
    }, [location.pathname, navigate]);

    return null;
}
