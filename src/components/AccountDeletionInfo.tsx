import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './ui/Icon';

const STEPS = [
    'Отворете приложението и влезте в акаунта си',
    'Натиснете върху потребителското си име в горния десен ъгъл',
    'В профилната страница натиснете бутона „Изтрий акаунт“',
    'Потвърдете изтриването в диалоговия прозорец',
];

const DELETED_DATA = [
    'Потребителско име',
    'Имейл адрес',
    'Парола (съхранявана в криптиран вид)',
    'Статистика за игри (победи и загуби)',
];

const AccountDeletionInfo: React.FC = () => {
    const navigate = useNavigate();

    return (
        <main className="screen" style={{ alignItems: 'flex-start' }}>
            <article className="doc">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
                    <Icon name="arrowLeft" size={16} />
                    Към приложението
                </button>

                <header style={{ marginTop: 'var(--sp-6)' }}>
                    <p style={brandStyle}>DECK.bg</p>
                    <h1>Изтриване на акаунт</h1>
                </header>

                <section>
                    <h2>Как да изтриете акаунта си</h2>
                    {/* numbered because order matters — a bullet list would lose that */}
                    <ol style={stepsStyle}>
                        {STEPS.map((step, i) => (
                            <li key={step} style={stepStyle}>
                                <span style={stepNumberStyle} aria-hidden="true">
                                    {i + 1}
                                </span>
                                <span style={{ color: 'var(--text-2)' }}>{step}</span>
                            </li>
                        ))}
                    </ol>
                </section>

                <section>
                    <h2>Данни, които се изтриват</h2>
                    <p>При изтриване на акаунта, следните данни ще бъдат премахнати безвъзвратно:</p>
                    <ul>
                        {DELETED_DATA.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </section>

                <section>
                    <h2>Период на съхранение</h2>
                    <div className="note note--warning" style={{ marginTop: 'var(--sp-3)' }}>
                        <Icon name="warning" size={18} className="note__icon" />
                        <span>
                            Всички ваши данни се изтриват <strong>незабавно</strong> и <strong>необратимо</strong> след
                            потвърждаване на заявката. Не се прилага допълнителен период на съхранение.
                        </span>
                    </div>
                </section>
            </article>
        </main>
    );
};

const brandStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-sm)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-3)',
    marginBottom: 'var(--sp-2)',
};

const stepsStyle: React.CSSProperties = {
    listStyle: 'none',
    margin: 'var(--sp-4) 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-3)',
};

const stepStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--sp-3)',
};

const stepNumberStyle: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--gold-wash)',
    border: '1px solid var(--line-gold)',
    color: 'var(--gold)',
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-sm)',
    fontWeight: 700,
};

export default AccountDeletionInfo;
