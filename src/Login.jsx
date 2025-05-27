import React, { useState } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';


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

  await updateProfile(userCredential.user, {
    displayName: prenom + ' ' + nom
  });

  await setDoc(doc(db, 'users', userCredential.user.uid), {
    prenom,
    nom,
    email,
    wilaya,
    createdAt: new Date()
  });

} catch (err) {
  console.log("Erreur d'inscription Firebase :", err);
  switch (err.code) {
    case 'auth/email-already-in-use':
      setError("Cette adresse email est déjà utilisée.");
      break;
    case 'auth/invalid-email':
      setError("Adresse email invalide.");
      break;
    case 'auth/weak-password':
      setError("Le mot de passe est trop faible. Il doit contenir au moins 6 caractères.");
      break;
    case 'auth/operation-not-allowed':
      setError("L'inscription par email/mot de passe n'est pas activée.");
      break;
    default:
      setError("Erreur lors de l'inscription : " + err.message);
  }
}

	  
    } else {
  if (!email || !password) {
    setError('Veuillez saisir votre email et mot de passe.');
    setLoading(false);
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.log("Erreur de connexion Firebase :", err);
    switch (err.code) {
      case 'auth/user-not-found':
        setError("Aucun compte trouvé avec cette adresse email.");
        break;
      case 'auth/wrong-password':
        setError("Mot de passe incorrect.");
        break;
      case 'auth/invalid-email':
        setError("Adresse email invalide.");
        break;
      case 'auth/too-many-requests':
        setError("Trop de tentatives échouées. Veuillez réessayer plus tard.");
        break;
		case 'auth/invalid-credential':
        setError("Adresse email ou mot de passe incorrect.");
        break;
      default:
        setError("Erreur lors de la connexion : " + err.message);
    }
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

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    fontFamily: 'Arial, sans-serif',
    minHeight: '100vh',
    backgroundColor: '#fff5f7',
    boxSizing: 'border-box',
  },
  box: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 15,
    boxShadow: '0 3px 10px rgba(123, 34, 51, 0.3)',
    width: '100%',
    maxWidth: 400,
    boxSizing: 'border-box',
  },
  title: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 25,
    color: '#7B2233',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    borderRadius: 6,
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: 14,
    fontSize: 16,
    backgroundColor: '#7B2233',
    color: 'white',
    border: 'none',
    borderRadius: 30,
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s ease',
  },
  error: {
    color: '#b22222',
    marginBottom: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  toggleText: {
    marginTop: 15,
    textAlign: 'center',
    fontSize: 14,
    color: '#555',
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    color: '#7B2233',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};

export default Login;
