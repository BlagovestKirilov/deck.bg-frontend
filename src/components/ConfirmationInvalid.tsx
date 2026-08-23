import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusScreen from './ui/StatusScreen';

const ConfirmationInvalid: React.FC = () => {
    const navigate = useNavigate();

    return (
        <StatusScreen
            tone="error"
            icon="xCircle"
            title="Невалиден линк"
            message="Линкът е невалиден или е изтекъл."
            actionLabel="Към сайта"
            onAction={() => navigate('/')}
        />
    );
};

export default ConfirmationInvalid;
