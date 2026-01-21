import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <button onClick={() => navigate('/')} style={styles.backButton}>
                    ← Назад
                </button>
                
                <h1 style={styles.title}>Политика за поверителност</h1>
                <p style={styles.date}>Последна актуализация: 21 януари 2026 г.</p>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>1. Въведение</h2>
                    <p style={styles.text}>
                        Добре дошли в Santase Game. Тази политика за поверителност обяснява как събираме, 
                        използваме и защитаваме вашата информация, когато използвате нашето приложение.
                    </p>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>2. Информация, която събираме</h2>
                    <p style={styles.text}>Ние събираме следната информация:</p>
                    <ul style={styles.list}>
                        <li>Потребителско име и имейл адрес при регистрация</li>
                        <li>Статистика от игрите (победи, загуби, ранг)</li>
                        <li>Информация за сесията за осигуряване на функционалността на играта</li>
                    </ul>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>3. Как използваме информацията</h2>
                    <p style={styles.text}>Използваме събраната информация за:</p>
                    <ul style={styles.list}>
                        <li>Предоставяне и поддържане на игровата услуга</li>
                        <li>Запазване на вашия прогрес и статистика</li>
                        <li>Осигуряване на мултиплейър функционалност</li>
                        <li>Подобряване на потребителското изживяване</li>
                    </ul>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>4. Съхранение на данни</h2>
                    <p style={styles.text}>
                        Вашите данни се съхраняват сигурно на нашите сървъри. Ние прилагаме 
                        подходящи технически и организационни мерки за защита на вашата информация.
                    </p>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>5. Споделяне на данни</h2>
                    <p style={styles.text}>
                        Ние не продаваме, търгуваме или по друг начин прехвърляме вашата лична 
                        информация на трети страни. Вашите данни се използват единствено за 
                        предоставяне на игровата услуга.
                    </p>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>6. Сигурност</h2>
                    <p style={styles.text}>
                        Използваме криптирана връзка (HTTPS/TLS) за защита на данните, предавани 
                        между вашето устройство и нашите сървъри.
                    </p>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>7. Вашите права</h2>
                    <p style={styles.text}>Имате право да:</p>
                    <ul style={styles.list}>
                        <li>Получите достъп до вашите лични данни</li>
                        <li>Поискате коригиране на неточни данни</li>
                        <li>Поискате изтриване на вашия акаунт и данни</li>
                    </ul>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>8. Деца</h2>
                    <p style={styles.text}>
                        Нашата услуга не е насочена към деца под 13 години. Ние съзнателно не 
                        събираме лична информация от деца под 13 години.
                    </p>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>9. Промени в политиката</h2>
                    <p style={styles.text}>
                        Можем да актуализираме тази политика за поверителност периодично. 
                        Ще ви уведомим за всички промени, като публикуваме новата политика на тази страница.
                    </p>
                </section>
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
    },
    content: {
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: '15px',
        padding: '40px',
        boxShadow: '0 0 40px rgba(0,0,0,0.8)',
        border: '2px solid #d4af37',
    },
    backButton: {
        padding: '10px 20px',
        backgroundColor: '#1a3a16',
        color: '#d4af37',
        border: 'none',
        borderRadius: '5px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        marginBottom: '20px',
    },
    title: {
        color: '#1a3a16',
        fontSize: '28px',
        marginBottom: '10px',
        textAlign: 'center',
    },
    date: {
        color: '#666',
        fontSize: '14px',
        textAlign: 'center',
        marginBottom: '30px',
        fontStyle: 'italic',
    },
    section: {
        marginBottom: '25px',
    },
    sectionTitle: {
        color: '#1a3a16',
        fontSize: '18px',
        marginBottom: '10px',
        borderBottom: '2px solid #d4af37',
        paddingBottom: '5px',
    },
    text: {
        color: '#333',
        fontSize: '15px',
        lineHeight: '1.6',
        margin: '10px 0',
    },
    list: {
        color: '#333',
        fontSize: '15px',
        lineHeight: '1.8',
        paddingLeft: '25px',
        margin: '10px 0',
    },
};

export default PrivacyPolicy;
