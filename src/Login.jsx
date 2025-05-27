import React, { useState } from 'react';
import { auth, db } from './firebase'; // Assure-toi que db est importé ici
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';  // Import Firestore

const Login = () => {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    wilaya: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { nom, prenom, wilaya, email, password } = form;

    if (mode === 'signup') {
      if (!nom || !prenom || !wilaya || !email || !password) {
        setError('Veuillez remplir tous les champs.');
        setLoading(false);
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Mettre à jour le displayName dans Firebase Auth
        await updateProfile(userCredential.user, {
          displayName: prenom + ' ' + nom
        });

        // Créer un document dans la collection "users" avec uid comme ID
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: email,
          nom: nom,
          prenom: prenom,
          wilaya: wilaya,
          createdAt: new Date()
        });

      } catch (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    } else {
      if (!email || !password) {
        setError('Veuillez saisir email et mot de passe.');
        setLoading(false);
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h2 style={styles.title}>Mon Compte NADSA</h2>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <input
                style={styles.input}
                name="prenom"
                placeholder="Prénom"
                value={form.prenom}
                onChange={handleChange}
                autoComplete="given-name"
              />
              <input
                style={styles.input}
                name="nom"
                placeholder="Nom"
                value={form.nom}
                onChange={handleChange}
                autoComplete="family-name"
              />
              <input
                style={styles.input}
                name="wilaya"
                placeholder="Wilaya"
                value={form.wilaya}
                onChange={handleChange}
              />
            </>
          )}
          <input
            style={styles.input}
            type="email"
            name="email"
            placeholder="Adresse email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />
          <input
            style={styles.input}
            type="password"
            name="password"
            placeholder="Mot de passe"
            value={form.password}
            onChange={handleChange}
            autoComplete={mode === 'signup' ? "new-password" : "current-password"}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Chargement...' : mode === 'signup' ? 'S’inscrire' : 'Se connecter'}
          </button>
        </form>
        <p style={styles.toggleText}>
          {mode === 'signup' ? 'Vous avez déjà un compte ?' : "Pas encore de compte ?"}{' '}
          <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }} style={styles.toggleButton}>
            {mode === 'signup' ? 'Se connecter' : "S’inscrire"}
          </button>
        </p>
      </div>
    </div>
  );
};

// (styles inchangés...)

export default Login;
