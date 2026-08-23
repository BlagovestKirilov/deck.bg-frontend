import React from 'react';
import Icon, { IconName } from './Icon';

type Tone = 'error' | 'success' | 'warning' | 'info';

const TONE_ICON: Record<Tone, IconName> = {
    error: 'warning',
    success: 'checkCircle',
    warning: 'warning',
    info: 'info',
};

interface NoteProps {
    tone: Tone;
    children: React.ReactNode;
    className?: string;
}

/**
 * Inline status message. Carries an icon as well as a color, so the meaning
 * survives for colorblind users and in grayscale. Errors announce themselves
 * to screen readers without stealing focus.
 */
const Note: React.FC<NoteProps> = ({ tone, children, className = '' }) => (
    <div
        className={`note note--${tone} ${className}`}
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
        <Icon name={TONE_ICON[tone]} size={18} className="note__icon" />
        <span style={{ whiteSpace: 'pre-line' }}>{children}</span>
    </div>
);

export default Note;
