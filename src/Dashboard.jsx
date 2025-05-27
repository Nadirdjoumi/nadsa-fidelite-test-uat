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
  Timestamp,
  getDoc,
  doc,
} from 'firebase/firestore';

const Dashboard = ({ user }) => {
  const [amount, setAmount] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('today');
  const [usersCache, setUsersCache] = useState({});

  const isAdmin = user?.email === 'admin@admin.com';

  const prenom = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
    ? user.email.split('@')[0]
    : 'Utilisateur';

  const calcPoints = montant => Math.floor(montant / 100);
  const calcRemise = points => Math.round((points * 1.3) / 10) * 10;

  const handleAddOrder = async () => {
    if (!amount || isNaN(amount)) return;
    setLoading(true);

    const montantInt = Math.floor(parseFloat(amount));
    const points = calcPoints(montantInt);
    const remise = calcRemise(points);

    await addDoc(collection(db, 'orders'), {
      userId: user.uid,
      userEmail: user.email,
      amount: montantInt,
      points,
      remise,
      createdAt: Timestamp.now(),
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

    if (isAdmin) {
      const newCache = { ...usersCache };
      for (const order of data) {
        // if (!newCache[order.userId]) {
          // try {
            // const userDoc = await getDoc(doc(db, 'users', order.userId));
            // newCache[order.userId] = userDoc.exists() ? userDoc.data().email : order.userEmail || 'Inconnu';
          // } catch (e) {
            // newCache[order.userId] = 'Erreur';
          // }
        // }
if (!newCache[order.userId]) {
  try {
    const userDoc = await getDoc(doc(db, 'users', order.userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const prenom = data.prenom || '';
      const nom = data.nom || '';
      const wilaya = data.wilaya || '';
      newCache[order.userId] = `${prenom} ${nom}${wilaya ? ' (' + wilaya + ')' : ''}`.trim() || order.userEmail || 'Inconnu';
    } else {
      newCache[order.userId] = order.userEmail || 'Inconnu';
    }
  } catch (e) {
    console.error('Erreur récupération utilisateur :', e);
    newCache[order.userId] = 'Erreur';
  }
}

      }
      setUsersCache(newCache);
    }

    setOrders(data);
    setLoading(false);
  };

  const logout = () => signOut(auth);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter(o => {
    if (!o.createdAt?.toDate) return false;
    const orderDate = o.createdAt.toDate();
    return orderDate >= startOfToday;
  });

  const totalToday = todayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalPoints = orders.reduce((sum, o) => sum + (o.points || 0), 0);
  const totalRemise = orders.reduce((sum, o) => sum + (o.remise || 0), 0);

  const displayedOrders = isAdmin && view === 'today' ? todayOrders : orders;

  const groupedByUser = isAdmin
    ? displayedOrders.reduce((acc, order) => {
        if (!acc[order.userId]) acc[order.userId] = [];
        acc[order.userId].push(order);
        return acc;
      }, {})
    : {};

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
              style={{ ...styles.button, backgroundColor: view === 'today' ? '#7B2233' : '#ccc' }}
            >
              Commandes du jour
            </button>
            <button
              onClick={() => setView('all')}
              style={{ ...styles.button, backgroundColor: view === 'all' ? '#7B2233' : '#ccc' }}
            >
              Toutes les commandes
            </button>
          </div>
        </div>
      )}

      <div style={styles.box}>
        <h3 style={styles.subtitle}>
          {isAdmin ? (view === 'today' ? 'Commandes du jour par client' : 'Toutes les commandes par client') : 'Historique'}
        </h3>

        {!isAdmin && displayedOrders.length === 0 && <p>Aucune commande.</p>}

        {isAdmin && Object.keys(groupedByUser).length === 0 && <p>Aucune commande.</p>}

        {!isAdmin && (
          <ul style={styles.list}>
            {displayedOrders.map(o => (
              <li key={o.id} style={styles.listItem}>
                <div>
                  <strong>{o.amount} DA</strong>
                  <br />
                  <small>{o.createdAt?.toDate().toLocaleString() || 'Date inconnue'}</small>
                </div>
              </li>
            ))}
          </ul>
        )}

        {isAdmin &&
          Object.entries(groupedByUser).map(([userId, userOrders]) => (
            <div key={userId} style={{ marginBottom: 30 }}>
              <h4 style={{ color: '#7B2233', marginBottom: 8 }}>
                Client : {usersCache[userId] || userId}
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
                <thead>
                  <tr style={{ background: '#f7d9dc', color: '#7B2233' }}>
                    <th style={styles.th}>Montant</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Points</th>
                    <th style={styles.th}>Remise</th>
                  </tr>
                </thead>
                <tbody>
                  {userOrders.map(order => (
                    <tr key={order.id}>
                      <td style={styles.td}>{order.amount} DA</td>
                      <td style={styles.td}>
                        {order.createdAt?.toDate().toLocaleString() || 'Date inconnue'}
                      </td>
                      <td style={styles.td}>{order.points}</td>
                      <td style={styles.td}>{order.remise} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: 20,
    fontFamily: 'Arial, sans-serif',
    maxWidth: 800,
    margin: '0 auto',
    background: '#fff5f7',
    minHeight: '100vh',
  },
  title: {
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 20,
    color: '#7B2233',
    fontWeight: 'bold',
  },
  logout: {
    display: 'block',
    margin: '10px auto 30px auto',
    background: '#7B2233',
    border: 'none',
    padding: '12px 30px',
    borderRadius: 30,
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 16,
  },
  box: {
    background: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    boxShadow: '0 3px 10px rgba(123, 34, 51, 0.3)',
  },
  subtitle: {
    fontSize: 20,
    marginBottom: 15,
    color: '#7B2233',
    fontWeight: '600',
  },
  input: {
    width: '100%',
    padding: 10,
    fontSize: 16,
    marginBottom: 10,
    borderRadius: 6,
    border: '1px solid #ccc',
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
  },
  stats: {
    marginTop: 20,
    lineHeight: 1.6,
    fontSize: 16,
    color: '#333',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    marginTop: 15,
  },
  listItem: {
    background: '#f7d9dc',
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#7B2233',
    fontWeight: '600',
    boxShadow: '0 2px 6px rgba(123, 34, 51, 0.15)',
  },
  th: {
    padding: '10px',
    borderBottom: '1px solid #ddd',
    textAlign: 'left',
  },
  td: {
    padding: '10px',
    borderBottom: '1px solid #eee',
  },
};

export default Dashboard;
