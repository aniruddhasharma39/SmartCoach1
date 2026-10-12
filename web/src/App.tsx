import { useState, useEffect } from 'react';
import Login from './screens/Login';
import Register from './screens/Register';
import Dashboard from './screens/Dashboard';
import type { User } from './types';
import { API_URL } from './config';

function App() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register' | 'dashboard'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(null);

  useEffect(() => {
    const onAuthExpired = (e: any) => {
      const msg = e.detail?.message || 'Your session has expired. Please log in again.';
      setSessionExpiredMsg(msg);
      setUser(null);
      setCurrentScreen('login');
    };
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setCurrentScreen('dashboard');

        // Proactively verify token validity with backend
        fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(async (res) => {
          if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setCurrentScreen('login');
            setSessionExpiredMsg('Your session has expired. Please log in again.');
          } else if (res.ok) {
            const freshUser = await res.json();
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          }
        }).catch(() => {
          // In case of network hiccup, allow cached user to remain loaded
        });
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setCurrentScreen('login');
      }
    }
  }, []);

  const handleLogin = (loggedInUser: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setSessionExpiredMsg(null);
    setUser(loggedInUser);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSessionExpiredMsg(null);
    setUser(null);
    setCurrentScreen('login');
  };

  return (
    <div className="app">
      {currentScreen === 'login' && (
        <Login 
          onLogin={handleLogin} 
          onGoToRegister={() => setCurrentScreen('register')} 
          sessionExpiredMsg={sessionExpiredMsg || undefined}
        />
      )}
      {currentScreen === 'register' && (
        <Register 
          onGoToLogin={() => setCurrentScreen('login')} 
        />
      )}
      {currentScreen === 'dashboard' && user && (
        <Dashboard 
          user={user} 
          onLogout={handleLogout} 
        />
      )}
    </div>
  );
}

export default App;

