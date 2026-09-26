import React from 'react';
import { Navigate } from 'react-router-dom';
import { servicesService } from '../api/servicesService';
import { GameKey } from '../types/user.types';

interface Props {
    service: GameKey;
    children: React.ReactElement;
}

/**
 * Keeps a player out of a game that is not being offered them.
 *
 * Decided from the last list this browser saw, which is why it is instant and
 * why it is only half the story: with nothing known yet, or a list from before
 * the switch, it lets the navigation through and the server answers 404. That
 * is the arrangement — this spares a pointless screen, the server is what
 * refuses.
 */
const RequireService: React.FC<Props> = ({ service, children }) => {
    const known = servicesService.lastKnown();

    if (known !== null && !known.includes(service)) {
        return <Navigate to="/" replace />;
    }
    return children;
};

export default RequireService;
