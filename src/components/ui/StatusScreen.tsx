import React from 'react';
import Icon, { IconName } from './Icon';
import Button from './Button';

type Tone = 'success' | 'error' | 'warning' | 'neutral';

const TONE_COLOR: Record<Tone, string> = {
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warning)',
    neutral: 'var(--gold)',
};

const TONE_WASH: Record<Tone, string> = {
    success: 'var(--success-wash)',
    error: 'var(--danger-wash)',
    warning: 'var(--warning-wash)',
    neutral: 'var(--gold-wash)',
};

interface StatusScreenProps {
    tone: Tone;
    icon: IconName;
    title: string;
    message: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
}

/**
 * Full-screen outcome page: confirmation succeeded, link invalid, account
 * deleted, route not found. Four near-identical copies of this markup used to
 * live in separate files; they are now one component with different content.
 */
const StatusScreen: React.FC<StatusScreenProps> = ({
    tone,
    icon,
    title,
    message,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondary,
}) => (
    <main className="screen">
        <div className="panel panel--gold" style={cardStyle}>
            <div
                style={{
                    ...markStyle,
                    background: TONE_WASH[tone],
                    color: TONE_COLOR[tone],
                    borderColor: TONE_COLOR[tone],
                }}
            >
                <Icon name={icon} size="52%" />
            </div>

            <h1 style={titleStyle}>{title}</h1>

            <p style={messageStyle}>{message}</p>

            {(actionLabel || secondaryLabel) && (
                <div style={actionsStyle}>
                    {actionLabel && onAction && (
                        <Button variant="primary" size="lg" block onClick={onAction}>
                            {actionLabel}
                        </Button>
                    )}
                    {secondaryLabel && onSecondary && (
                        <Button variant="ghost" block onClick={onSecondary}>
                            {secondaryLabel}
                        </Button>
                    )}
                </div>
            )}
        </div>
    </main>
);

const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '440px',
    padding: 'clamp(28px, 6vw, 44px) clamp(20px, 5vw, 40px)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-4)',
};

const markStyle: React.CSSProperties = {
    width: 'clamp(72px, 20vw, 104px)',
    height: 'clamp(72px, 20vw, 104px)',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    border: '2px solid',
    animation: 'scale-in var(--dur-slow) var(--ease-spring)',
};

const titleStyle: React.CSSProperties = {
    fontSize: 'var(--fs-2xl)',
    color: 'var(--text-1)',
    fontWeight: 600,
};

const messageStyle: React.CSSProperties = {
    color: 'var(--text-2)',
    fontSize: 'var(--fs-md)',
    maxWidth: '42ch',
};

const actionsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-3)',
    width: '100%',
    marginTop: 'var(--sp-2)',
};

export default StatusScreen;
