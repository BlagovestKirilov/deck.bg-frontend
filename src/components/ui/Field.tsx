import React, { useId, useState } from 'react';
import Icon from './Icon';

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
    label: string;
    /** Error text shown under the field. Also flags the input as invalid. */
    error?: string | null;
    /** Persistent helper text — survives focus, unlike a placeholder. */
    hint?: string;
    required?: boolean;
}

/**
 * Labelled text input.
 *
 * - real <label for> (a placeholder is not a label)
 * - error sits under its own field and is announced via role="alert"
 * - password fields get a show/hide toggle with a 44px hit area
 * - 16px font size so iOS does not zoom the viewport on focus
 */
const Field = React.forwardRef<HTMLInputElement, FieldProps>(
    ({ label, error, hint, required, type = 'text', className = '', ...rest }, ref) => {
        const uid = useId();
        const inputId = `f-${uid}`;
        const errorId = `${inputId}-err`;
        const hintId = `${inputId}-hint`;

        const isPassword = type === 'password';
        const [revealed, setRevealed] = useState(false);
        const resolvedType = isPassword && revealed ? 'text' : type;

        const describedBy = [error ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(' ');

        return (
            <div className="field">
                <label className="field__label" htmlFor={inputId}>
                    {label}
                    {required && (
                        <span className="field__req" aria-hidden="true">
                            *
                        </span>
                    )}
                </label>

                <div className="field__wrap">
                    <input
                        ref={ref}
                        id={inputId}
                        type={resolvedType}
                        required={required}
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={describedBy || undefined}
                        className={`field__input ${isPassword ? 'field__input--with-affix' : ''} ${className}`}
                        {...rest}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            className="field__affix"
                            onClick={() => setRevealed((v) => !v)}
                            aria-label={revealed ? 'Скрий паролата' : 'Покажи паролата'}
                            aria-pressed={revealed}
                            tabIndex={-1}
                        >
                            <Icon name={revealed ? 'eyeOff' : 'eye'} size={20} />
                        </button>
                    )}
                </div>

                {hint && !error && (
                    <span className="field__hint" id={hintId}>
                        {hint}
                    </span>
                )}

                {error && (
                    <span className="field__error" id={errorId} role="alert">
                        <Icon name="warning" size={16} />
                        {error}
                    </span>
                )}
            </div>
        );
    },
);

Field.displayName = 'Field';

export default Field;
