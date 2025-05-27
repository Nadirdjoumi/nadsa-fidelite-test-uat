// src/Login.jsx
import React, { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    try {
      setError('');
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <h2>{isRegister ? "Créer un compte" : "Connexion"}</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={styles.input}
      />
      <input
        type="password"
        placeholder="Mot de passe"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={styles.input}
      />
      {error && <p style={styles.error}>{error}</p>}
      <button onClick={handleAuth} style={styles.button}>
        {isRegister ? "S'inscrire" : "Se connecter"}
      </button>
      <p>
        {isRegister ? "Déjà un compte ?" : "Pas encore inscrit ?"}
        <button onClick={() => setIsRegister(!isRegister)} style={styles.link}>
          {isRegister ? "Se connecter" : "Créer un compte"}
        </button>
      </p>
    </div>
  );
};

const styles = {
  container: {
    padding: 20,
    fontFamily: 'sans-serif',
    maxWidth: 400,
    margin: '0 auto',
    textAlign: 'center'
  },
  input: {
    width: '100%',
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
    border: '1px solid #ccc',
    fontSize: 16
  },
  button: {
    width: '100%',
    padding: 12,
    background: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 16
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    cursor: 'pointer',
    marginLeft: 8,
    fontSize: 14
  },
  error: {
    color: 'red',
    marginBottom: 10
  }
};

export default Login;
