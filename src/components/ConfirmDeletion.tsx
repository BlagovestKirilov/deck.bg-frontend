import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { userService } from '../api/userService';
import { REMEMBERED_USERNAME, useAuthContext } from '../context/AuthContext';
import StatusScreen from './ui/StatusScreen';

/**
 * The page the account-deletion email links to.
 *
 * <p>The deletion used to happen on the email link itself, as a GET. Anything
 * that fetches a link without a person behind it — Outlook Safe Links, mail
 * scanners, antivirus, some mobile clients prefetching — deleted the account
 * on its own. Nothing is deleted here until the button is pressed: the page
 * only shows a prompt on load, and a prefetcher runs no JavaScript.
 */
const ConfirmDeletion: React.FC = () => {
    const navigate = useNavigate();
    const { logout } = useAuthContext();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!token) navigate('/invalid', { replace: true });
    }, [token, navigate]);

    if (!token) return null;

    const onConfirm = async () => {
        setBusy(true);
        try {
            const deleted = await userService.confirmDeletion(token);
            if (deleted) {
                // The account is gone, so the session pointing at it is too.
                // Without this the stored token outlives the user and the next
                // request bounces through a failed refresh to the login screen.
                logout();
                try {
                    localStorage.removeItem(REMEMBERED_USERNAME);
                } catch {
                    // Storage can be unavailable; nothing here is essential.
                }
            }
            navigate(deleted ? '/deletion-success' : '/invalid', { replace: true });
        } catch {
            // The token may well still be good — a network failure is not a
            // dead link, so send them nowhere and let them press again.
            setBusy(false);
        }
    };

    return (
        <StatusScreen
            tone="warning"
            icon="warning"
            title="Изтриване на акаунт"
            message="Това ще изтрие акаунта ви и всички ваши данни безвъзвратно. Действието не може да бъде отменено."
            actionLabel="Изтрий акаунта"
            actionVariant="danger"
            actionLoading={busy}
            onAction={onConfirm}
            secondaryLabel="Отказ"
            onSecondary={() => navigate('/')}
        />
    );
};

export default ConfirmDeletion;
