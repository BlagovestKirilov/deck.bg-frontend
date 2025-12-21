import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ username: '', password: '' });
    const { performAction, isLoading, error } = useAuth();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const action = isLogin ? 'login' : 'register';
        try {
            const response = await performAction(action, form);
            console.log("Success:", response.message);
            // Redirect or show success state here
        } catch (err) {
            // Errors (429 Rate Limit, 401 Unauthorized, etc.) are caught by the hook
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                <p style={styles.subtitle}>
                    {isLogin ? 'Enter your details to login' : 'Sign up to get started'}
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Username</label>
                        <input
                            type="text"
                            name="username"
                            value={form.username}
                            onChange={handleInputChange}
                            placeholder="Min 5 characters"
                            style={styles.input}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleInputChange}
                            placeholder="••••••••"
                            style={styles.input}
                            required
                        />
                    </div>

                    {/* Error Message Display (Handles Spring Validation or Nginx 429) */}
                    {error && <div style={styles.errorBox}>{error}</div>}

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{...styles.button, opacity: isLoading ? 0.7 : 1}}
                    >
                        {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
                    </button>
                </form>

                <p style={styles.toggleText}>
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <span
                        onClick={() => setIsLogin(!isLogin)}
                        style={styles.toggleLink}
                    >
            {isLogin ? ' Register here' : ' Login here'}
          </span>
                </p>
            </div>
        </div>
    );
};

// --- Styles (CSS-in-JS for instant use) ---
const styles: { [key: string]: React.CSSProperties } = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' },
    card: { backgroundColor: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
    title: { margin: '0 0 10px 0', fontSize: '24px', textAlign: 'center', color: '#333' },
    subtitle: { margin: '0 0 30px 0', fontSize: '14px', textAlign: 'center', color: '#666' },
    form: { display: 'flex', flexDirection: 'column' },
    inputGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#555' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', boxSizing: 'border-box' },
    button: { width: '100%', padding: '14px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.3s' },
    errorBox: { padding: '10px', backgroundColor: '#fff2f2', border: '1px solid #ffcccc', color: '#d8000c', borderRadius: '6px', marginBottom: '20px', fontSize: '13px' },
    toggleText: { marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#666' },
    toggleLink: { color: '#007bff', cursor: 'pointer', fontWeight: 'bold' }
};

export default AuthPage;