import React from 'react';
import Icon, { IconName } from './Icon';
import Button from './Button';
import CardIndex from '../lobby/CardIndex';

type Tone = 'success' | 'error' | 'warning' | 'neutral';

/**
 * The mark above the title, in the card's own inks: the table green for a
 * good outcome, suit red for one that went wrong or needs care.
 */
const TONE_INK: Record<Tone, string> = {
    success: 'var(--felt-ink)',
    error: 'var(--suit-red)',
    warning: 'var(--suit-red)',
    neutral: 'var(--ink-3)',
};

interface StatusScreenProps {
    tone: Tone;
    icon: IconName;
    title: string;
    message?: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    /** Destructive outcomes need a red primary action, not the green one. */
    actionVariant?: 'primary' | 'danger';
    /** Spinner on the primary action; also blocks a second press. */
    actionLoading?: boolean;
    secondaryLabel?: string;
    onSecondary?: () => void;
}

/**
 * Full-screen outcome page: confirmation succeeded, link invalid, account
 * deleted, route not found.
 *
 * Most of these are reached from a link in an email, so they are printed on
 * the same card as the sign-in screen, dealt on the same felt. Signing in,
 * registering and resetting a password are A♠, Q♥ and Q♦; an outcome is the
 * fourth face in the fourth suit, K♣, so the whole flow is one hand.
 */
const StatusScreen: React.FC<StatusScreenProps> = ({
    tone,
    icon,
    title,
    message,
    actionLabel,
    onAction,
    actionVariant = 'primary',
    actionLoading = false,
    secondaryLabel,
    onSecondary,
}) => (
    <main className="screen screen--flow lobby lobby-auth">
        <div className="deal deal--center">
            <section className="play-card status-card" aria-labelledby="status-title">
                <CardIndex rank="K" suit="♣" red={false} corner="tl" />
                <CardIndex rank="K" suit="♣" red={false} corner="br" />

                <header className="play-card__head">
                    <span className="status-card__mark" style={{ color: TONE_INK[tone] }}>
                        <Icon name={icon} size={30} />
                    </span>
                    <h1 id="status-title" className="play-card__title">{title}</h1>
                    {message && <p className="play-card__sub">{message}</p>}
                </header>

                {(actionLabel || secondaryLabel) && (
                    <div className="play-card__foot status-card__actions">
                        {actionLabel && onAction && (
                            <Button variant={actionVariant} size="lg" block loading={actionLoading} onClick={onAction}>
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
            </section>
        </div>
    </main>
);

export default StatusScreen;
