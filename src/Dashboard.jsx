// src/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';

const Dashboard = ({ user }) => {
  const [amount, setAmount] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('today');

  const isAdmin = user?.email === 'admin@admin.com';

  const handleAddOrder = async () => {
    if (!amount) return;
    setLoading(true);
    await addDoc(collection(db, 'orders'), {
      userId: user.uid,
      amount: parseFloat(amount),
      createdAt: Timestamp.now()
    });
    setAmount('');
    fetchOrders();
    setLoading(false);
  };

  const fetchOrders = async () => {
    setLoading(true);
    let q;

    if (isAdmin) {
      q = query(collection(db, 'orders'));
    } else {
      q = query(collection(db, 'orders'), where('userId', '==', user.uid));
    }

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setOrders(data);
    setLoading(false);
  };

  const logout = () => {
    signOut(auth);
  };

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toISOString().split('T')[0] === today);
  const totalToday = todayOrders.reduce((sum, o) => sum + o.amount, 0);
  const totalAll = orders.reduce((sum, o) => sum + o.amount, 0);

  const points = totalAll;
  const discount = (points / 100 * 5).toFixed(2);

  const displayedOrders = isAdmin && view === 'today' ? todayOrders : orders;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Bienvenue {isAdmin ? 'Admin' : user.email}</h2>
      <button onClick={logout} style={styles.logout}>Se déconnecter</button>

      {!isAdmin && (
        <div style={styles.box}>
          <h3 style={styles.subtitle}>Ajouter une commande</h3>
          <input
            type="number"
            placeholder="Montant €"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={styles.input}
          />
          <button onClick={handleAddOrder} style={styles.button} disabled={loading}>
            {loading ? 'Envoi...' : 'Ajouter'}
          </button>

          <div style={styles.stats}>
            <p><strong>Total aujourd'hui :</strong> {totalToday.toFixed(2)} €</p>
            <p><strong>Points cumulés :</strong> {points} pts</p>
            <p><strong>Remise obtenue :</strong> {discount} €</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div style={styles.box}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <button onClick={() => setView('today')} style={{ ...styles.button, background: view === 'today' ? '#2196f3' : '#ccc' }}>Commandes du jour</button>
            <button onClick={() => setView('all')} style={{ ...styles.button, background: view === 'all' ? '#2196f3' : '#ccc' }}>Toutes les commandes</button>
          </div>
        </div>
      )}

      <div style={styles.box}>
        <h3 style={styles.subtitle}>{isAdmin ? (view === 'today' ? 'Commandes du jour' : 'Toutes les commandes') : 'Historique'}</h3>
        {displayedOrders.length === 0 && <p>Aucune commande.</p>}
        <ul style={styles.list}>
          {displayedOrders.map(o => (
            <li key={o.id} style={styles.listItem}>
              <div>
                <strong>{o.amount} €</strong>
                <br />
                <small>{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : 'Date inconnue'}</small>
              </div>
              {isAdmin && <small>Client: {o.userId}</small>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: 20,
    fontFamily: 'sans-serif',
    maxWidth: 500,
    margin: '0 auto',
    background: '#f9f9f9',
    minHeight: '100vh'
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 10
  },
  logout: {
    display: 'block',
    margin: '10px auto 30px auto',
    background: '#bbb',
    border: 'none',
    padding: 10,
    borderRadius: 6,
    cursor: 'pointer'
  },
  box: {
    background: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 10
  },
  input: {
    width: '100%',
    padding: 10,
    fontSize: 16,
    marginBottom: 10,
    borderRadius: 6,
    border: '1px solid #ccc'
  },
  button: {
    width: '100%',
    padding: 12,
    fontSize: 16,
    background: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer'
  },
  stats: {
    marginTop: 15,
    lineHeight: 1.6
  },
  list: {
    listStyle: 'none',
    padding: 0,
    marginTop: 10
  },
  listItem: {
    background: '#eee',
    marginBottom: 10,
    padding: 10,
    borderRadius: 6,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
};

export default Dashboard;
