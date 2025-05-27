// src/Login.jsx
import React, { useState } from 'react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const Login = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    wilaya: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const { nom, prenom, wilaya, email, password } = formData;
        if (!nom || !prenom || !wilaya || !email || !password) {
          setError('Merci de remplir tous les champs.');
          setLoading(false);
          return;
        }

        // Créer le compte utilisateur
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Mettre à jour le profil utilisateur (displayName avec prénom + nom)
        await updateProfile(user, { displayName: `${prenom} ${nom}` });

        // Enregistrer les infos complémentaires dans Firestore
        await setDoc(doc(db, 'users', user.uid), {
          nom,
          prenom,
          wilaya,
          email,
          createdAt: new Date(),
        });

        alert('Inscription réussie, vous pouvez maintenant vous connecter.');

        // Reset form et passer en mode connexion
        setFormData({
          nom: '',
          prenom: '',
          wilaya: '',
          email: '',
          password: '',
        });
        setIsRegister(false);

      } else {
        const { email, password } = formData;
        if (!email || !password) {
          setError('Merci de remplir email et mot de passe.');
          setLoading(false);
          return;
        }

        // Connexion utilisateur
        await signInWithEmailAndPassword(auth, email, password);

        // Appel callback parent pour indiquer la connexion réussie
        if (onLogin) onLogin();

        // Tu peux ici rediriger ou afficher autre chose
      }
    } catch (err) {
      console.error(err);
      // Gestion d’erreur basique
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError("Cet email est déjà utilisé.");
          break;
        case 'auth/invalid-email':
          setError("Email invalide.");
          break;
        case 'auth/weak-password':
          setError("Mot de passe trop faible (au moins 6 caractères).");
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setError("Email ou mot de passe incorrect.");
          break;
        default:
          setError(err.message);
      }
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Mon Compte NADSA</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        {isRegister && (
          <>
            <input
              style={styles.input}
              type="text"
              name="nom"
              placeholder="Nom"
              value={formData.nom}
              onChange={handleChange}
              disabled={loading}
            />
            <input
              style={styles.input}
              type="text"
              name="prenom"
              placeholder="Prénom"
              value={formData.prenom}
              onChange={handleChange}
              disabled={loading}
            />
            <input
              style={styles.input}
              type="text"
              name="wilaya"
              placeholder="Wilaya"
              value={formData.wilaya}
              onChange={handleChange}
              disabled={loading}
            />
          </>
        )}
        <input
          style={styles.input}
          type="email"
          name="email"
          placeholder="Adresse email"
          value={formData.email}
          onChange={handleChange}
          disabled={loading}
        />
        <input
          style={styles.input}
          type="password"
          name="password"
          placeholder="Mot de passe"
          value={formData.password}
          onChange={handleChange}
          disabled={loading}
        />
        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Chargement...' : (isRegister ? "S'inscrire" : 'Se connecter')}
        </button>
      </form>

      <p style={styles.switchText}>
        {isRegister ? 'Vous avez déjà un compte ?' : "Pas encore de compte ?"}{' '}
        <button
          style={styles.switchButton}
          onClick={() => {
            setIsRegister(!isRegister);
            setError('');
            setFormData({
              nom: '',
              prenom: '',
              wilaya: '',
              email: '',
              password: '',
            });
          }}
          type="button"
          disabled={loading}
        >
          {isRegister ? 'Se connecter' : "S'inscrire"}
        </button>
      </p>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: 400,
    margin: '50px auto',
    padding: 30,
    borderRadius: 12,
    backgroundColor: '#5B2333',
    color: '#fff',
    boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: '700',
    fontSize: 28,
    letterSpacing: 2,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  input: {
    marginBottom: 15,
    padding: 12,
    fontSize: 16,
    borderRadius: 6,
    border: 'none',
    outline: 'none',
    fontWeight: '600',
    backgroundColor: '#7A3B4B',
    color: '#fff',
  },
  button: {
    padding: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#5B2333',
    backgroundColor: '#F1C40F',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  error: {
    marginBottom: 15,
    color: '#ffdddd',
    backgroundColor: '#8B0000',
    padding: 10,
    borderRadius: 6,
    fontWeight: '600',
    textAlign: 'center',
  },
  switchText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
    color: '#ddd',
  },
  switchButton: {
    background: 'none',
    border: 'none',
    color: '#F1C40F',
    cursor: 'pointer',
    fontWeight: '700',
    textDecoration: 'underline',
    padding: 0,
    marginLeft: 6,
  },
};

export default Login;
