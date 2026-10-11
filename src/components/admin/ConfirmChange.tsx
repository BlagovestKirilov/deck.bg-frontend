import React from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

export interface PendingChange {
    /** The question, naming what changes: "Изключи Белот?", "Дай тест достъп на petko91?" */
    title: string;
    /** What it does to the players, in their terms. */
    text: string;
    /** The action, named as the title names it: "Изключи", "Дай достъп". */
    confirmLabel: string;
    /** A change that takes something away from players reads in red. */
    danger?: boolean;
    run: () => void;
}

/**
 * The question every admin change asks before it is made.
 *
 * Every switch on this page changes what other people see the moment it is
 * pressed, so none of them acts on the press alone. The question names the
 * game or the player it touches, and the buttons say what happens — never a
 * bare "OK".
 */
const ConfirmChange: React.FC<{ change: PendingChange; onClose: () => void }> = ({ change, onClose }) => (
    <Modal
        title={change.title}
        width="narrow"
        className="lobby sheet"
        onClose={onClose}
        actions={
            <>
                <Button variant="ghost" onClick={onClose}>Отказ</Button>
                <Button
                    variant={change.danger ? 'danger' : 'primary'}
                    onClick={() => {
                        onClose();
                        change.run();
                    }}
                >
                    {change.confirmLabel}
                </Button>
            </>
        }
    >
        <p className="sheet__text">{change.text}</p>
    </Modal>
);

export default ConfirmChange;
