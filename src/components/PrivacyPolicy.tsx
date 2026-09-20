import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './ui/Icon';

interface Clause {
    title: string;
    body: React.ReactNode;
}

/**
 * The policy's clauses, in order. Numbered because a policy is cited by clause
 * — "see point 7" — so the numbers carry meaning, not decoration.
 */
const CLAUSES: Clause[] = [
    {
        title: 'Въведение',
        body: (
            <p>
                Добре дошли в DECK.bg. Тази политика обяснява как събираме, използваме и защитаваме вашата
                информация, когато играете Сантасе и Табла на deck.bg — в браузъра или в мобилното приложение.
            </p>
        ),
    },
    {
        title: 'Информация, която събираме',
        body: (
            <>
                <p>Събираме следната информация:</p>
                <ul>
                    <li>Потребителско име и имейл адрес при регистрация</li>
                    <li>IP адресът, от който влизате в акаунта си</li>
                    <li>Статистика от игрите — победи, загуби и ранг, отделно за Сантасе и за Табла</li>
                    <li>Информация за сесията, необходима за работата на игрите</li>
                </ul>
                <p>
                    Последното използвано потребителско име се пази само на вашето устройство, за да бъде попълнено
                    при следващия вход. Не се изпраща никъде и никой друг сайт няма достъп до него.
                </p>
            </>
        ),
    },
    {
        title: 'Как използваме информацията',
        body: (
            <>
                <p>Използваме събраната информация за:</p>
                <ul>
                    <li>Предоставяне и поддържане на игрите</li>
                    <li>Запазване на вашия прогрес и статистика</li>
                    <li>Игра срещу други играчи в реално време</li>
                    <li>Подобряване на потребителското изживяване</li>
                </ul>
            </>
        ),
    },
    {
        title: 'Съхранение на данни',
        body: (
            <p>
                Вашите данни се съхраняват сигурно на нашите сървъри. Прилагаме подходящи технически и
                организационни мерки за защитата им.
            </p>
        ),
    },
    {
        title: 'Споделяне на данни',
        body: (
            <p>
                Не продаваме, не търгуваме и не прехвърляме по друг начин вашата лична информация на трети
                страни. Данните ви се използват единствено за работата на DECK.bg.
            </p>
        ),
    },
    {
        title: 'Сигурност',
        body: (
            <p>
                Използваме криптирана връзка (HTTPS/TLS) за защита на данните, предавани между вашето устройство
                и нашите сървъри.
            </p>
        ),
    },
    {
        title: 'Вашите права',
        body: (
            <>
                <p>Имате право да:</p>
                <ul>
                    <li>Получите достъп до вашите лични данни</li>
                    <li>Поискате коригиране на неточни данни</li>
                    <li>
                        Поискате изтриване на акаунта и данните си — <Link to="/delete-account">как се прави
                        и какво се запазва</Link>
                    </li>
                </ul>
            </>
        ),
    },
    {
        title: 'Деца',
        body: (
            <p>
                DECK.bg не е предназначен за деца под 13 години. Не събираме съзнателно лична информация от деца
                под 13 години.
            </p>
        ),
    },
    {
        title: 'Промени в политиката',
        body: (
            <p>
                Можем да актуализираме тази политика. Всяка промяна се публикува на тази страница, заедно с датата
                на последната актуализация.
            </p>
        ),
    },
];

/**
 * The privacy policy, printed on the lobby's card stock.
 *
 * A long read, so dark ink on a light sheet rather than light text on the
 * felt — the same stock the sign-in card is printed on, laid on the table.
 */
const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <main className="screen screen--flow lobby legal-page" style={{ alignItems: 'flex-start' }}>
            <div className="legal">
                <nav className="legal__bar">
                    <button type="button" className="btn btn--ghost btn--sm legal__back" onClick={() => navigate('/')}>
                        <Icon name="arrowLeft" size={18} />
                        DECK.bg
                    </button>
                </nav>

                <article className="legal__sheet">
                    <header className="legal__head">
                        <h1 className="legal__title">Политика за поверителност</h1>
                        <p className="legal__date">Последна актуализация: 19 септември 2026 г.</p>
                    </header>

                    <ol className="legal__clauses">
                        {CLAUSES.map((clause, i) => (
                            <li key={clause.title} className="legal__clause">
                                <span className="legal__num" aria-hidden="true">{i + 1}</span>
                                <section aria-labelledby={`clause-${i + 1}`}>
                                    <h2 id={`clause-${i + 1}`} className="legal__heading">
                                        <span className="sr-only">{i + 1}. </span>
                                        {clause.title}
                                    </h2>
                                    <div className="legal__body">{clause.body}</div>
                                </section>
                            </li>
                        ))}
                    </ol>
                </article>
            </div>
        </main>
    );
};

export default PrivacyPolicy;
