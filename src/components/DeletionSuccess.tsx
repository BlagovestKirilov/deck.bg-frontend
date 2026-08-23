import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusScreen from './ui/StatusScreen';

const DeletionSuccess: React.FC = () => {
    const navigate = useNavigate();

    return (
        <StatusScreen
            tone="success"
            icon="checkCircle"
            title="Акаунтът е изтрит!"
            message="Вашият акаунт беше успешно изтрит. Всички ваши данни са премахнати безвъзвратно. Благодарим ви, че използвахте нашето приложение!"
            actionLabel="Към началната страница"
            onAction={() => navigate('/')}
        />
    );
};

export default DeletionSuccess;
