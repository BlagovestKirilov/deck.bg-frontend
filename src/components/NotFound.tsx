import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusScreen from './ui/StatusScreen';

const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <StatusScreen
            tone="neutral"
            icon="compass"
            title="Страницата не е намерена"
            message="Страницата, която търсите, не съществува или е преместена."
            actionLabel="Към началната страница"
            onAction={() => navigate('/')}
        />
    );
};

export default NotFound;
