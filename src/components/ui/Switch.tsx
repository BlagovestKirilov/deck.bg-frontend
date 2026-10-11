import React from 'react';

interface SwitchProps {
    /** What is being switched, for assistive technology. Stays the same in both states. */
    label: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    /** The visible words for each state. */
    onText: string;
    offText: string;
    disabled?: boolean;
}

/**
 * An on/off control that takes effect when it is pressed.
 *
 * A button with role="switch": the state is announced from aria-checked, so
 * the name does not change with it, and the words beside the track say the
 * state for everyone else. The whole row is the target, at least 44px tall.
 */
const Switch: React.FC<SwitchProps> = ({ label, checked, onChange, onText, offText, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' switch--on' : ''}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
    >
        <span className="switch__track" aria-hidden="true">
            <span className="switch__knob" />
        </span>
        <span className="switch__text">{checked ? onText : offText}</span>
    </button>
);

export default Switch;
