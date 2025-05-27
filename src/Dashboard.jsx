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

  const prenom = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
      ? user.email.split('@')[0]
      : 'Utilisateur';

  const handleAddOrder = async () => {
    if (!amount) return;
    setLoading(true);

    // Convertir en entier arrondi (sans centimes), en DA
    const montantDA = Math.round(Number(amount));

    // Calculs
    const points = Math.floor(montantDA / 100);
    const remise = Math.round(points * 1.3 / 10) * 10; // arrondi à la dizaine

    await addDoc(collection(db, 'orders'), {
      userId: user.uid,
      amount: montantDA,
      points,
      remise,
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

  // Points et remise cumulés sur toutes les commandes
  const totalPoints = orders.reduce((sum, o) => sum + (o.points || 0), 0);
  const totalRemise = orders.reduce((sum, o) => sum + (o.remise || 0), 0);

  const displayedOrders = isAdmin && view === 'today' ? todayOrders : orders;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Bienvenue {prenom}</h2>
      <button onClick={logout} style={styles.logout}>Se déconnecter</button>

      {!isAdmin && (
        <div style={styles.box}>
          <h3 style={styles.subtitle}>Ajouter une commande</h3>
          <input
            type="number"
            placeholder="Montant en DA"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={styles.input}
            min={0}
          />
          <button onClick={handleAddOrder} style={styles.button} disabled={loading}>
            {loading ? 'Envoi...' : 'Ajouter'}
          </button>

          <div style={styles.stats}>
            <p><strong>Total aujourd'hui :</strong> {totalToday} DA</p>
            <p><strong>Points cumulés :</strong> {totalPoints} pts</p>
            <p><strong>Remise obtenue :</strong> {totalRemise} DA</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div style={styles.box}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <button
              onClick={() => setView('today')}
              style={{ ...styles.button, backgroundColor: view === 'today' ? '#7B2233' : '#ccc', width: 'auto', padding: '10px 20px' }}
            >
              Commandes du jour
            </button>
            <button
              onClick={() => setView('all')}
              style={{ ...styles.button, backgroundColor: view === 'all' ? '#7B2233' : '#ccc', width: 'auto', padding: '10px 20px' }}
            >
              Toutes les commandes
            </button>
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
                <strong>{o.amount} DA</strong>
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
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
    fontFamily: 'Arial, sans-serif',
    maxWidth: 600,
    margin: '0 auto',
    backgroundColor: '#fff5f7',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  box: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    boxShadow: '0 3px 10px rgba(123, 34, 51, 0.3)',
    width: '100%',
    maxWidth: 400,
    boxSizing: 'border-box',
  },
  title: {
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 20,
    color: '#7B2233',
    fontWeight: 'bold',
    width: '100%',
  },
  subtitle: {
    fontSize: 20,
    marginBottom: 15,
    color: '#7B2233',
    fontWeight: 'bold',
    textAlign: 'center',
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
  logout: {
    backgroundColor: '#b22222',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 30,
    cursor: 'pointer',
    alignSelf: 'flex-end',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  stats: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
  },
  list: {
    listStyleType: 'none',
    paddingLeft: 0,
    maxHeight: 300,
    overflowY: 'auto',
  },
  listItem: {
    padding: 10,
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
};

export default Dashboard;
