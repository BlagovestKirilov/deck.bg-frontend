import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusScreen from './ui/StatusScreen';

/** Where the link in the confirmation email lands. */
const ConfirmationSuccess: React.FC = () => {
    const navigate = useNavigate();

    return (
        <StatusScreen
            tone="success"
            icon="checkCircle"
            title="Имейлът е потвърден"
            actionLabel="Играй"
            onAction={() => navigate('/')}
        />
    );
};

export default ConfirmationSuccess;
