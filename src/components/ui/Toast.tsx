import React, { useEffect, useRef } from 'react';
import Icon, { IconName } from './Icon';
import { t } from '../../styles/tokens';

type Tone = 'error' | 'success' | 'warning' | 'info';

const TONE_ICON: Record<Tone, IconName> = {
    error: 'warning',
    success: 'checkCircle',
    warning: 'warning',
    info: 'info',
};

interface ToastProps {
    tone: Tone;
    children: React.ReactNode;
    /** Called when its time is up, so the caller can drop it from the tree. */
    onDone: () => void;
}

/**
 * A message that appears over the page and takes itself away.
 *
 * Use it for something the player should notice but never has to act on — the
 * game they clicked is not available, a move was refused. Anything they must
 * answer belongs in a `Modal`, and anything that should stay while they work
 * belongs in a `Note`.
 *
 * It takes no taps, so it cannot swallow a press meant for what is underneath,
 * and it never takes focus: a screen reader hears it through `aria-live` while
 * the player carries on wherever they were.
 */
const Toast: React.FC<ToastProps> = ({ tone, children, onDone }) => {
    // The clock starts once and is never restarted. Callers pass an inline
    // arrow, which is a different function on every render of the page around
    // it; depending on it would push the toast's own deadline away each time.
    const done = useRef(onDone);
    done.current = onDone;

    useEffect(() => {
        const id = setTimeout(() => done.current(), t.toastMs);
        return () => clearTimeout(id);
    }, []);

    return (
        <div className="toast-slot">
            <div className={`toast toast--${tone}`} role="status" aria-live="polite">
                <Icon name={TONE_ICON[tone]} size={20} className="toast__icon" />
                <span>{children}</span>
            </div>
        </div>
    );
};

export default Toast;
