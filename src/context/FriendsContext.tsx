import React, { createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from './AuthContext';
import { Friends, useFriends } from '../hooks/useFriends';
import ChallengeCard from '../components/friends/ChallengeCard';
import Toast from '../components/ui/Toast';

const FriendsContext = createContext<Friends | null>(null);

/**
 * A signed-in player's friends, for every screen but the game's own.
 *
 * One connection for the friends topic, held on the hub, the profile, the
 * admin page — wherever a challenge can be answered — and the challenge card
 * is drawn over whichever of them is up. Not on a game screen: opening a game
 * opens no socket until the player searches (the start screen waits for one
 * round trip, not five), and a player searching or playing is busy — the
 * server will not let anyone challenge them.
 */
export const FriendsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAuthContext();
    const { pathname } = useLocation();
    const active = isAuthenticated && !pathname.startsWith('/play/');
    const friends = useFriends(active ? user?.username ?? '' : '');

    return (
        <FriendsContext.Provider value={friends}>
            {children}
            {active && <ChallengeCard friends={friends} />}
            {active && friends.notice && (
                <Toast tone="info" onDone={friends.clearNotice}>{friends.notice}</Toast>
            )}
        </FriendsContext.Provider>
    );
};

/** The signed-in player's friends; only inside {@link FriendsProvider}. */
export function useFriendsContext(): Friends {
    const friends = useContext(FriendsContext);
    if (!friends) throw new Error('useFriendsContext outside FriendsProvider');
    return friends;
}
