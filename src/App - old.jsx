import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';


import { signInWithEmailAndPassword } from "firebase/auth";
import Login from './Login';
import Dashboard from './Dashboard'; // à créer ensuite
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

signInWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Connexion réussie
  })
  .catch((error) => {
    console.error(error.message);
  });

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Gérer les connexions/déconnexions
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  return (
    <>
      {user ? <Dashboard user={user} /> : <Login onLogin={() => {}} />}
    </>
  );
}

export default App;


import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAgZwOWhw2T9nu7rUVHly407ICK4BT0oIo",
  authDomain: "nadsa-fidelite.firebaseapp.com",
  projectId: "nadsa-fidelite",
  storageBucket: "nadsa-fidelite.firebasestorage.app",
  messagingSenderId: "304170417691",
  appId: "1:304170417691:web:74c5c03b06b61bf88982be",
  measurementId: "G-SJQSRMZD4P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [orders, setOrders] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setIsAdmin(u.email === 'admin@tonsite.com');
        fetchOrders(u);
      } else {
        setUser(null);
        setOrders([]);
      }
    });
  }, []);

  const fetchOrders = async (u) => {
    const q = isAdmin ? query(collection(db, 'orders')) : query(collection(db, 'orders'), where('uid', '==', u.uid));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setOrders(data);
  };

  const handleRegister = () => createUserWithEmailAndPassword(auth, email, password);
  const handleLogin = () => signInWithEmailAndPassword(auth, email, password);
  const handleLogout = () => signOut(auth);

  const handleAddOrder = async () => {
    if (user && orderAmount) {
      await addDoc(collection(db, 'orders'), {
        uid: user.uid,
        email: user.email,
        amount: parseFloat(orderAmount),
        date: Timestamp.now(),
      });
      setOrderAmount('');
      fetchOrders(user);
    }
  };

  const today = new Date();
  const todayOrders = orders.filter(o => o.date.toDate().toDateString() === today.toDateString());
  const totalPoints = orders.reduce((sum, o) => sum + o.amount, 0);
  const todayTotal = todayOrders.reduce((sum, o) => sum + o.amount, 0);

  if (!user) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">Connexion ou Inscription</h1>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 mb-2 border" />
        <input placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 mb-2 border" />
        <button onClick={handleLogin} className="w-full bg-blue-500 text-white p-2 mb-2">Connexion</button>
        <button onClick={handleRegister} className="w-full bg-green-500 text-white p-2">Créer un compte</button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Bienvenue {user.email}</h1>
      <button onClick={handleLogout} className="bg-red-500 text-white p-2 mb-4">Déconnexion</button>
      {!isAdmin && (
        <>
          <input placeholder="Montant de la commande" type="number" value={orderAmount} onChange={e => setOrderAmount(e.target.value)} className="w-full p-2 mb-2 border" />
          <button onClick={handleAddOrder} className="w-full bg-blue-600 text-white p-2 mb-4">Ajouter la commande</button>
          <h2 className="text-lg font-semibold">Commandes aujourd'hui : {todayTotal.toFixed(2)} €</h2>
          <h2 className="text-lg font-semibold mb-4">Points cumulés : {totalPoints.toFixed(2)} points</h2>
        </>
      )}

      {isAdmin && (
        <>
          <h2 className="text-lg font-semibold">Vue admin</h2>
          <h3 className="font-semibold mt-4">Commandes aujourd'hui</h3>
          <ul className="mb-4">
            {todayOrders.map(o => (
              <li key={o.id}>{o.email} - {o.amount} €</li>
            ))}
          </ul>
          <h3 className="font-semibold">Toutes les commandes</h3>
          <ul>
            {orders.map(o => (
              <li key={o.id}>{o.email} - {o.amount} € - {o.date.toDate().toLocaleDateString()}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
