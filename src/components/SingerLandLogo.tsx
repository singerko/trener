type LogoSize = 'sm' | 'md' | 'lg';

interface SingerLandLogoProps {
    subtitle?: string;
    size?: LogoSize;
    centered?: boolean;
}

const fontSizes: Record<LogoSize, { brand: string; sub: string }> = {
    sm: { brand: '1.4rem', sub: '0.55rem' },
    md: { brand: '1.8rem', sub: '0.65rem' },
    lg: { brand: '2.6rem', sub: '0.85rem' },
};

export default function SingerLandLogo({ subtitle, size = 'md', centered = false }: SingerLandLogoProps) {
    const fs = fontSizes[size];

    return (
        <div className={`singerland-logo ${centered ? 'items-center' : 'items-start'}`}>
            <div className="singerland-logo__lockup">
                <div className="flex items-baseline">
                    <span className="singerland-logo__singer" style={{ fontSize: fs.brand }}>Singer</span>
                    <span className="singerland-logo__land" style={{ fontSize: fs.brand }}>Land</span>
                </div>
                {subtitle && (
                    <span className="singerland-logo__subtitle" style={{ fontSize: fs.sub }}>
                        {subtitle}
                    </span>
                )}
            </div>
        </div>
    );
}
