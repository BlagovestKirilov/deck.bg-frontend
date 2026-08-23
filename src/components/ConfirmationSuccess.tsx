import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusScreen from './ui/StatusScreen';

const ConfirmationSuccess: React.FC = () => {
    const navigate = useNavigate();

    return (
        <StatusScreen
            tone="success"
            icon="checkCircle"
            title="Имейлът е потвърден!"
            message="Вашият имейл адрес е успешно потвърден. Сега можете да влезете в профила си и да започнете да играете!"
            actionLabel="Към сайта"
            onAction={() => navigate('/')}
        />
    );
};

export default ConfirmationSuccess;
