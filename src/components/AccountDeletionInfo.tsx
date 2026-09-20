import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './ui/Icon';

/**
 * Steps as the app actually works today. Deletion is confirmed by email, so a
 * request made by someone else on an unlocked phone still cannot go through.
 */
const STEPS: React.ReactNode[] = [
    'Влезте в DECK.bg — в браузъра или в мобилното приложение.',
    'Натиснете потребителското си име горе вдясно, за да отворите профила.',
    'Най-долу натиснете «Изтрий акаунт», въведете паролата си и потвърдете.',
    'Ще получите имейл. Отворете линка в него.',
    'На страницата, която се отваря, натиснете «Изтрий акаунта».',
];

/** Removed the moment step 5 is confirmed — the user and everything cascading from it. */
const DELETED = [
    'Профилът ви, имейл адресът и паролата',
    'IP адресът, от който сте влизали',
    'Статистиката и рангът — за Сантасе и за Табла',
];

/**
 * Kept after deletion, as the backend does it (UserMapper.toDeletedUser and
 * UserUtilService.deleteUser; changeset 016 cleared everything else from older
 * records). Keep this list in step with that code: a deletion page that
 * promises more than the code does is the one thing it must never be.
 */
const RETAINED = [
    'Потребителското име и датата на изтриване',
    'Резултатите от изиграните игри',
];

/**
 * How to delete an account, and what deleting does. Linked from the privacy
 * policy and given to the app stores as the account-deletion page.
 */
const AccountDeletionInfo: React.FC = () => {
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
                        <h1 className="legal__title">Изтриване на акаунт</h1>
                        <p className="legal__date">Как да изтриете акаунта си в DECK.bg и какво става с данните ви.</p>
                    </header>

                    <section className="legal__section" aria-labelledby="del-how">
                        <h2 id="del-how" className="legal__heading">Как да изтриете акаунта си</h2>
                        <div className="legal__body">
                            <p>
                                Имейлът ви трябва да е потвърден. Ако не е, в профила има бутон «Изпрати имейл за
                                потвърждение».
                            </p>
                        </div>
                        {/* Numbered because the order matters. */}
                        <ol className="legal__steps">
                            {STEPS.map((step, i) => (
                                <li key={i} className="legal__step">
                                    <span className="legal__num" aria-hidden="true">{i + 1}</span>
                                    <span className="legal__body">{step}</span>
                                </li>
                            ))}
                        </ol>
                        <div className="legal__body">
                            <p>
                                Не можете да влезете? Използвайте «Забравена парола?» на екрана за вход, за да зададете
                                нова парола.
                            </p>
                        </div>
                    </section>

                    <section className="legal__section" aria-labelledby="del-gone">
                        <h2 id="del-gone" className="legal__heading">Какво се изтрива</h2>
                        <div className="legal__body">
                            <p>Веднага щом потвърдите на стъпка 5, безвъзвратно се изтриват:</p>
                            <ul>
                                {DELETED.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                            <p>След това никой не може да влезе с този акаунт.</p>
                        </div>
                    </section>

                    <section className="legal__section" aria-labelledby="del-kept">
                        <h2 id="del-kept" className="legal__heading">Какво се запазва</h2>
                        <div className="legal__body">
                            <p>
                                Запазва се само това, което е нужно, за да се виждат правилно изиграните игри на
                                другите играчи:
                            </p>
                            <ul>
                                {RETAINED.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                            <p>
                                Имейл адресът, паролата и IP адресът не се пазят. Запазените данни не са свързани с
                                акаунт, в който някой може да влезе.
                            </p>
                        </div>
                    </section>
                </article>
            </div>
        </main>
    );
};

export default AccountDeletionInfo;
