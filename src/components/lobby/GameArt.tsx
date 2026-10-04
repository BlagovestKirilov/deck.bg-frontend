import React from 'react';

/*
 * The hub's two pictures: the games themselves, lying on the cloth.
 *
 * Inline SVG so they are sharp at any density and cost no request. They are
 * decoration — the button around them carries the name — so both are hidden
 * from assistive technology.
 */

const CARD_FILL = '#faf8f3';
const INK = '#1d1b18';
const RED = '#b4232c';
const EDGE = 'rgba(0, 0, 0, 0.2)';

/**
 * The index face on the card art: the one the cards at the table print their
 * corners in, so the picture shows the cards the player will hold. The lobby's
 * condensed face drew J as a bare stem with a stub of a hook, which read as
 * a letter cut off on the left.
 */
const INDEX_FONT = "'Fredoka', 'Segoe UI', system-ui, sans-serif";

interface FanCardProps {
    rank: string;
    suit: string;
    red: boolean;
    angle: number;
    className: string;
}

/**
 * One card of the hand. The outer group holds the card's place in the fan;
 * the inner one is free for CSS to turn on hover. A CSS transform replaces an
 * SVG transform attribute rather than adding to it, so the two must not share
 * an element.
 */
/**
 * Card size in the art, and the point the hand is held by. The pivot sits well
 * above the bottom edge: the outer cards turn 27°, which swings their lower
 * corners ~10 units below it, and the whole fan is centred in the frame.
 */
const CARD_W = 44;
const CARD_H = 62;
const PIVOT_X = 80;
const PIVOT_Y = 96;

const FanCard: React.FC<FanCardProps> = ({ rank, suit, red, angle, className }) => {
    const ink = red ? RED : INK;
    const x = PIVOT_X - CARD_W / 2;
    const y = PIVOT_Y - CARD_H;
    return (
        <g transform={`rotate(${angle} ${PIVOT_X} ${PIVOT_Y})`}>
            <g className={`art-card ${className}`}>
                <rect x={x} y={y} width={CARD_W} height={CARD_H} rx="4.5" fill={CARD_FILL} stroke={EDGE} />
                <text x={x + 5} y={y + 14} fill={ink} fontFamily={INDEX_FONT} fontWeight={600} fontSize="13">
                    {rank}
                </text>
                <text x={x + 4.5} y={y + 25} fill={ink} fontSize="9.5">{suit}</text>
                <text x={PIVOT_X} y={y + 44} fill={ink} fontSize="22" textAnchor="middle">{suit}</text>
            </g>
        </g>
    );
};

/**
 * Сантасе: the four aces, fanned — the highest card in every suit, and the
 * colours alternating the way a hand is sorted.
 */
export const SantaseArt: React.FC = () => (
    <svg viewBox="0 0 160 120" aria-hidden="true" focusable="false" className="art-fan">
        <defs>
            <filter id="santase-art-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.45" />
            </filter>
        </defs>
        <g filter="url(#santase-art-shadow)">
            <FanCard rank="А" suit="♠" red={false} angle={-27} className="art-card--1" />
            <FanCard rank="А" suit="♥" red angle={-9} className="art-card--2" />
            <FanCard rank="А" suit="♣" red={false} angle={9} className="art-card--3" />
            <FanCard rank="А" suit="♦" red angle={27} className="art-card--4" />
        </g>
    </svg>
);

/**
 * Белот: the four jacks, fanned — the highest trump whichever suit is called,
 * and a carré worth 200. Colours alternate the way a hand is sorted.
 */
export const BelotArt: React.FC = () => (
    <svg viewBox="0 0 160 120" aria-hidden="true" focusable="false" className="art-fan">
        <defs>
            <filter id="belot-art-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.45" />
            </filter>
        </defs>
        <g filter="url(#belot-art-shadow)">
            <FanCard rank="J" suit="♠" red={false} angle={-24} className="art-card--1" />
            <FanCard rank="J" suit="♥" red angle={-8} className="art-card--2" />
            <FanCard rank="J" suit="♣" red={false} angle={8} className="art-card--3" />
            <FanCard rank="J" suit="♦" red angle={24} className="art-card--4" />
        </g>
    </svg>
);

/* ---- Табла ---- */

const WOOD_FRAME = '#5b3519';
const WOOD_FIELD = '#c79a63';
const POINT_DARK = '#3e2210';
const POINT_LIGHT = '#ecd6ad';
const CHECKER_LIGHT = '#f4efe4';
const CHECKER_DARK = '#2a1c12';

const FIELD_X = 18;
const FIELD_W = 124;
const POINT_W = FIELD_W / 6;

/** Pip positions on a 22px die face, by value. */
const PIPS: Record<number, [number, number][]> = {
    5: [[6, 6], [16, 6], [11, 11], [6, 16], [16, 16]],
    6: [[6, 5.5], [16, 5.5], [6, 11], [16, 11], [6, 16.5], [16, 16.5]],
};

const Die: React.FC<{ value: 5 | 6; x: number; y: number; tilt: number; className: string }> = ({
    value, x, y, tilt, className,
}) => (
    <g transform={`translate(${x} ${y}) rotate(${tilt} 11 11)`}>
        <g className={`art-die ${className}`}>
            <rect width="22" height="22" rx="4.5" fill={CARD_FILL} stroke={EDGE} />
            {PIPS[value].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.1" fill={INK} />
            ))}
        </g>
    </g>
);

const Checker: React.FC<{ cx: number; cy: number; light: boolean }> = ({ cx, cy, light }) => (
    <circle
        cx={cx}
        cy={cy}
        r="8.3"
        fill={light ? CHECKER_LIGHT : CHECKER_DARK}
        stroke={light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.12)'}
    />
);

const pointCentre = (i: number) => FIELD_X + POINT_W * i + POINT_W / 2;

/**
 * Табла: one side of the board, a few checkers in play, and шеш-беш — six
 * and five — on the dice, the roll everyone at a табла table knows by name.
 */
export const TablaArt: React.FC = () => (
    <svg viewBox="0 0 160 120" aria-hidden="true" focusable="false" className="art-dice">
        <defs>
            <filter id="tabla-art-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodOpacity="0.5" />
            </filter>
        </defs>

        <rect x="12" y="14" width="136" height="92" rx="6" fill={WOOD_FRAME} />
        <rect x={FIELD_X} y="20" width={FIELD_W} height="80" fill={WOOD_FIELD} />

        {Array.from({ length: 6 }, (_, i) => {
            const left = FIELD_X + POINT_W * i;
            const mid = left + POINT_W / 2;
            const right = left + POINT_W;
            return (
                <React.Fragment key={i}>
                    <polygon
                        points={`${left},20 ${right},20 ${mid},56`}
                        fill={i % 2 === 0 ? POINT_DARK : POINT_LIGHT}
                    />
                    <polygon
                        points={`${left},100 ${right},100 ${mid},64`}
                        fill={i % 2 === 0 ? POINT_LIGHT : POINT_DARK}
                    />
                </React.Fragment>
            );
        })}

        <g filter="url(#tabla-art-shadow)">
            <Checker cx={pointCentre(0)} cy={29} light />
            <Checker cx={pointCentre(0)} cy={45} light />
            <Checker cx={pointCentre(4)} cy={29} light={false} />
            <Checker cx={pointCentre(1)} cy={91} light />
            <Checker cx={pointCentre(5)} cy={91} light={false} />
            <Checker cx={pointCentre(5)} cy={75} light={false} />

            <Die value={6} x={62} y={46} tilt={-9} className="art-die--a" />
            <Die value={5} x={88} y={51} tilt={12} className="art-die--b" />
        </g>
    </svg>
);
