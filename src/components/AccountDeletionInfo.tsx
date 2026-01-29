import React from 'react';
import { Link } from 'react-router-dom';

const AccountDeletionInfo: React.FC = () => {
    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <div style={styles.card}>
                    <h1 style={styles.appName}>DECK.bg</h1>
                    <h2 style={styles.title}>Изтриване на акаунт</h2>

                    <section style={styles.section}>
                        <h3 style={styles.sectionTitle}>Как да изтриете акаунта си</h3>
                        <ol style={styles.stepsList}>
                            <li style={styles.step}>
                                <span style={styles.stepNumber}>1</span>
                                <span style={styles.stepText}>Отворете приложението и влезте в акаунта си</span>
                            </li>
                            <li style={styles.step}>
                                <span style={styles.stepNumber}>2</span>
                                <span style={styles.stepText}>Натиснете върху потребителското си име в горния десен ъгъл</span>
                            </li>
                            <li style={styles.step}>
                                <span style={styles.stepNumber}>3</span>
                                <span style={styles.stepText}>В профилната страница натиснете бутона "Изтрий акаунт"</span>
                            </li>
                            <li style={styles.step}>
                                <span style={styles.stepNumber}>4</span>
                                <span style={styles.stepText}>Потвърдете изтриването в диалоговия прозорец</span>
                            </li>
                        </ol>
                    </section>

                    <section style={styles.section}>
                        <h3 style={styles.sectionTitle}>Данни, които се изтриват</h3>
                        <p style={styles.paragraph}>
                            При изтриване на акаунта, следните данни ще бъдат премахнати безвъзвратно:
                        </p>
                        <ul style={styles.dataList}>
                            <li style={styles.dataItem}>Потребителско име</li>
                            <li style={styles.dataItem}>Имейл адрес</li>
                            <li style={styles.dataItem}>Парола (съхранявана в криптиран вид)</li>
                            <li style={styles.dataItem}>Статистика за игри (победи и загуби)</li>
                        </ul>
                    </section>

                    <section style={styles.section}>
                        <h3 style={styles.sectionTitle}>Период на съхранение</h3>
                        <p style={styles.paragraph}>
                            Всички ваши данни се изтриват <strong>незабавно</strong> и <strong>необратимо</strong> 
                            след потвърждаване на заявката. Не се прилага допълнителен период на съхранение.
                        </p>
                    </section>

                    <div style={styles.footer}>
                        <Link to="/" style={styles.backLink}>
                            ← Към приложението
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100%',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle, #1a3a16 0%, #0a1a08 100%)',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: '20px',
        boxSizing: 'border-box',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    content: {
        maxWidth: '600px',
        width: '100%',
        margin: '0 auto',
        padding: '20px 0',
    },
    card: {
        backgroundColor: 'rgba(26, 26, 26, 0.98)',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
    },
    appName: {
        color: '#d4af37',
        fontSize: '2rem',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '10px',
        marginTop: 0,
    },
    title: {
        color: '#e57373',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    section: {
        marginBottom: '30px',
    },
    sectionTitle: {
        color: '#d4af37',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        marginBottom: '15px',
        marginTop: 0,
    },
    stepsList: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
    },
    step: {
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '15px',
        gap: '15px',
    },
    stepNumber: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px',
        backgroundColor: '#1a3a16',
        color: '#d4af37',
        borderRadius: '50%',
        fontWeight: 'bold',
        fontSize: '0.9rem',
        flexShrink: 0,
    },
    stepText: {
        color: '#fff',
        fontSize: '1rem',
        lineHeight: '1.6',
        paddingTop: '3px',
    },
    paragraph: {
        color: '#b0b0b0',
        fontSize: '1rem',
        lineHeight: '1.6',
        marginBottom: '15px',
    },
    dataList: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
    },
    dataItem: {
        color: '#fff',
        fontSize: '1rem',
        lineHeight: '1.8',
        paddingLeft: '20px',
        position: 'relative',
    },
    footer: {
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
    },
    backLink: {
        color: '#d4af37',
        textDecoration: 'none',
        fontSize: '1rem',
        fontWeight: 'bold',
        padding: '12px 24px',
        backgroundColor: '#1a3a16',
        borderRadius: '8px',
        display: 'inline-block',
        transition: 'all 0.3s ease',
    },
};

export default AccountDeletionInfo;
