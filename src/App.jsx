// src/App.jsx
import React, { useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import Dashboard from './Dashboard';
import Login from './Login';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <p style={{ textAlign: 'center', marginTop: 50 }}>Chargement...</p>;

  return (
    <div>
      {user ? <Dashboard user={user} /> : <Login onLogin={() => {}} />}
    </div>
  );
};

export default App;
