import React from 'react';

interface ChoiceOption<T extends string> {
    value: T;
    label: string;
}

interface ChoiceProps<T extends string> {
    /** What is being chosen. Shown above the options, and the group's name. */
    legend: string;
    options: ChoiceOption<T>[];
    value: T;
    onChange: (next: T) => void;
    disabled?: boolean;
}

/**
 * One of a few options, side by side, chosen with a press.
 *
 * A fieldset of buttons with aria-pressed rather than radio inputs: picking
 * one acts at once, like the switch beside it, so it is a set of buttons and
 * says so. Pressing the one already chosen does nothing.
 */
function Choice<T extends string>({ legend, options, value, onChange, disabled }: ChoiceProps<T>) {
    return (
        <fieldset className="choice" disabled={disabled}>
            <legend className="choice__legend">{legend}</legend>
            <div className="choice__options">
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className="choice__option"
                        aria-pressed={option.value === value}
                        onClick={() => {
                            if (option.value !== value) onChange(option.value);
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </fieldset>
    );
}

export default Choice;
