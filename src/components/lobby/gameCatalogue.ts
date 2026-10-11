import React from 'react';
import { GameKey } from '../../types/user.types';
import { BelotArt, SantaseArt, TablaArt } from './GameArt';

/** The games, as the hub and the admin page draw them: name, rule, picture, way in. */
export interface GameCard {
    key: GameKey;
    title: string;
    /** How the game is won. The title says which game it is; this says what
     *  you are trying to do, which is the part a newcomer does not know. */
    tagline: string;
    Art: React.FC;
    path: string;
}

export const GAMES: GameCard[] = [
    {
        key: 'BELOT',
        title: 'Белот',
        tagline: 'Двама срещу двама, до 151',
        Art: BelotArt,
        path: '/play/belot',
    },
    {
        key: 'SANTASE',
        title: 'Сантасе',
        tagline: 'Първият до 66 точки печели',
        Art: SantaseArt,
        path: '/play/santase',
    },
    {
        key: 'TABLA',
        title: 'Табла',
        tagline: 'Изведи всички пулове пръв',
        Art: TablaArt,
        path: '/play/tabla',
    },
];
