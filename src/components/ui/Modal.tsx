import React, { useCallback, useEffect, useId, useRef } from 'react';
import Icon from './Icon';

interface ModalProps {
    title?: string;
    /** Omit to make the dialog non-dismissible (e.g. a forced choice). */
    onClose?: () => void;
    children: React.ReactNode;
    /** Buttons rendered in the footer row. */
    actions?: React.ReactNode;
    tone?: 'default' | 'danger';
    width?: 'narrow' | 'default';
    /** Close when the scrim behind the dialog is clicked. Default true. */
    dismissOnScrim?: boolean;
    className?: string;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog.
 *
 * - traps Tab inside while open, restores focus to the trigger on close
 * - Escape closes (an escape route is required for every modal)
 * - locks background scroll so the page behind cannot move under the scrim
 * - scrim is opaque enough that foreground text stays legible
 */
const Modal: React.FC<ModalProps> = ({
    title,
    onClose,
    children,
    actions,
    tone = 'default',
    width = 'default',
    dismissOnScrim = true,
    className = '',
}) => {
    const uid = useId();
    const titleId = `m-${uid}`;
    const dialogRef = useRef<HTMLDivElement>(null);
    const restoreTo = useRef<HTMLElement | null>(null);

    // Remember what had focus, move focus into the dialog, give it back on close.
    useEffect(() => {
        restoreTo.current = document.activeElement as HTMLElement | null;

        const node = dialogRef.current;
        const first = node?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? node)?.focus();

        const { overflow } = document.body.style;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = overflow;
            restoreTo.current?.focus?.();
        };
    }, []);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape' && onClose) {
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key !== 'Tab') return;

            const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
            if (!nodes || nodes.length === 0) return;

            const first = nodes[0];
            const last = nodes[nodes.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        },
        [onClose],
    );

    return (
        <div
            className="scrim"
            onMouseDown={(e) => {
                if (dismissOnScrim && onClose && e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                className={[
                    'modal',
                    tone === 'danger' ? 'modal--danger' : '',
                    width === 'narrow' ? 'modal--narrow' : '',
                    className,
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                {(title || onClose) && (
                    <div className="panel__header">
                        {title ? (
                            <h2
                                id={titleId}
                                className="panel__title"
                                style={tone === 'danger' ? { color: 'var(--danger-bright)' } : undefined}
                            >
                                {title}
                            </h2>
                        ) : (
                            <span />
                        )}
                        {onClose && (
                            <button
                                type="button"
                                className="btn btn--icon"
                                onClick={onClose}
                                aria-label="Затвори"
                            >
                                <Icon name="close" size={20} />
                            </button>
                        )}
                    </div>
                )}

                <div className="modal__body scroll-y">{children}</div>

                {actions && <div className="modal__actions">{actions}</div>}
            </div>
        </div>
    );
};

export default Modal;
