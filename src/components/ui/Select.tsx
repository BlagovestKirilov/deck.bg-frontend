import React, { useId } from 'react';
import Icon from './Icon';

interface SelectOption<T extends string> {
    value: T;
    label: string;
}

interface SelectProps<T extends string> {
    label: string;
    options: SelectOption<T>[];
    value: T;
    onChange: (next: T) => void;
    disabled?: boolean;
}

/**
 * Labelled drop-down, dressed like {@link Field}.
 *
 * The browser's own select underneath, so a phone opens its native picker
 * and the keyboard works as it always does; only the closed control is drawn
 * here. 16px text, like every input, so iOS does not zoom on focus.
 */
function Select<T extends string>({ label, options, value, onChange, disabled }: SelectProps<T>) {
    const id = `s-${useId()}`;
    return (
        <div className="field">
            <label className="field__label" htmlFor={id}>{label}</label>
            <div className="field__wrap">
                <select
                    id={id}
                    className="field__input field__select"
                    value={value}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value as T)}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <span className="field__chevron" aria-hidden="true">
                    <Icon name="chevronDown" />
                </span>
            </div>
        </div>
    );
}

export default Select;
