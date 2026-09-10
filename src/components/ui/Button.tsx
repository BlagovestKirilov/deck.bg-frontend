import React from 'react';
import Icon, { IconName } from './Icon';

type Variant =
    | 'primary'
    | 'gold'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'danger-outline'
    | 'link';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    variant?: Variant;
    size?: 'sm' | 'md' | 'lg';
    block?: boolean;
    /** Shows a spinner and blocks further presses. Width stays put. */
    loading?: boolean;
    icon?: IconName;
    iconAfter?: IconName;
    children?: React.ReactNode;
}

/**
 * Every button in the app. Guarantees a >=44px hit area, a visible pressed
 * state that does not shift layout, a real disabled state, and a loading
 * state that cannot be double-submitted.
 */
const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    block,
    loading = false,
    icon,
    iconAfter,
    children,
    className = '',
    disabled,
    type = 'button',
    ...rest
}) => {
    const classes = [
        'btn',
        `btn--${variant}`,
        size !== 'md' ? `btn--${size}` : '',
        block ? 'btn--block' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            type={type}
            className={classes}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...rest}
        >
            <span className={loading ? 'btn__label--loading' : undefined} style={contentStyle}>
                {icon && <Icon name={icon} />}
                {children != null && <span className="btn__label">{children}</span>}
                {iconAfter && <Icon name={iconAfter} />}
            </span>
            {loading && (
                <span className="btn__spinner">
                    <span className="spinner" />
                </span>
            )}
        </button>
    );
};

const contentStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
};

export default Button;
