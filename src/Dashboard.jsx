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
  doc,
  setDoc,
  getDoc,
  orderBy
} from 'firebase/firestore';

const Dashboard = ({ user }) => {
  const [amount, setAmount] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('today');

  const [usersList, setUsersList] = useState([]);
  const [usedPointsMap, setUsedPointsMap] = useState({});

  const isAdmin = user?.email === 'admin@admin.com';

  // --- Ajout d'une fonction pour récupérer tous les users (admin)
  const fetchUsers = async () => {
    const q = query(collection(db, 'users'), orderBy('lastName'));
    const snapshot = await getDocs(q);
    const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setUsersList(usersData);
  };

  // --- Fonction pour récupérer les points utilisés de tous les users (admin)
  const fetchUsedPointsForUsers = async (users) => {
    const map = {};
    for (const u of users) {
      const docRef = doc(db, 'usedPoints', u.id);
      const docSnap = await getDoc(docRef);
      map[u.id] = docSnap.exists() ? docSnap.data().used : 0;
    }
    setUsedPointsMap(map);
  };

  // --- Fonction pour récupérer commandes
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

  // --- Fonction pour "utiliser la remise" (admin)
  const handleUseDiscountForUser = async (userId) => {
    // Calcule la somme totale des commandes du user
    const userOrders = orders.filter(o => o.userId === userId);
    const total = userOrders.reduce((sum, o) => sum + o.amount, 0);
    // Enregistre cette valeur dans usedPoints
    await setDoc(doc(db, 'usedPoints', userId), {
      used: total,
      updatedAt: Timestamp.now()
    });
    await fetchUsedPointsForUsers(usersList);
  };

  // --- Fonction pour "ajouter une commande" (client)
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

  // --- Logout
  const logout = () => {
    signOut(auth);
  };

  // --- useEffect pour récupérer les données selon user/admin
  useEffect(() => {
    if (user) {
      fetchOrders();
      if (isAdmin) {
        fetchUsers().then(fetchedUsers => {
          fetchUsedPointsForUsers(fetchedUsers);
        });
      } else {
        // Pour client, récupérer usedPoints de lui-même
        const fetchUsedPoints = async () => {
          const docRef = doc(db, 'usedPoints', user.uid);
          const docSnap = await getDoc(docRef);
          setUsedPointsMap({
            [user.uid]: docSnap.exists() ? docSnap.data().used : 0
          });
        };
        fetchUsedPoints();
      }
    }
  }, [user]);

  // --- Calculs pour affichage

  // Pour client uniquement : commandes du jour, total aujourd'hui
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toISOString().split('T')[0] === today);
  const totalToday = todayOrders.reduce((sum, o) => sum + o.amount, 0);

  if (!isAdmin) {
    const totalAll = orders.reduce((sum, o) => sum + o.amount, 0);
    const used = usedPointsMap[user.uid] || 0;
    const netPoints = totalAll - used;
    const discount = (netPoints / 100 * 5).toFixed(2);

    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Bienvenue {user.email}</h2>
        <button onClick={logout} style={styles.logout}>Se déconnecter</button>

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
            <p><strong>Points cumulés :</strong> {netPoints} pts</p>
            <p><strong>Remise obtenue :</strong> {discount} €</p>
          </div>
        </div>

        <div style={styles.box}>
          <h3 style={styles.subtitle}>Historique</h3>
          {orders.length === 0 && <p>Aucune commande.</p>}
          <ul style={styles.list}>
            {orders.map(o => (
              <li key={o.id} style={styles.listItem}>
                <div>
                  <strong>{o.amount} €</strong>
                  <br />
                  <small>{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : 'Date inconnue'}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // --- Pour admin : afficher liste utilisateurs + points + remise + bouton utiliser remise

  // Fonction pour calculer total commandes et points d'un user
  const getUserTotals = (userId) => {
    const userOrders = orders.filter(o => o.userId === userId);
    const total = userOrders.reduce((sum, o) => sum + o.amount, 0);
    const used = usedPointsMap[userId] || 0;
    const netPoints = total - used;
    const discount = (netPoints / 100 * 5).toFixed(2);
    return { total, used, netPoints, discount };
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Bienvenue Admin</h2>
      <button onClick={logout} style={styles.logout}>Se déconnecter</button>

      <div style={styles.box}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={() => setView('today')} style={{ ...styles.button, background: view === 'today' ? '#2196f3' : '#ccc' }}>Commandes du jour</button>
          <button onClick={() => setView('all')} style={{ ...styles.button, background: view === 'all' ? '#2196f3' : '#ccc' }}>Toutes les commandes</button>
        </div>
      </div>

      <div style={styles.box}>
        <h3 style={styles.subtitle}>Liste des clients</h3>
        {usersList.length === 0 && <p>Aucun client trouvé.</p>}
        <ul style={styles.list}>
          {usersList.map(u => {
            const totals = getUserTotals(u.id);
            return (
              <li key={u.id} style={styles.listItem}>
                <div>
                  <strong>{u.firstName} {u.lastName} ({u.email})</strong>
                  <br />
                  <small>Points cumulés : {totals.netPoints} pts</small>
                  <br />
                  <small>Remise obtenue : {totals.discount} €</small>
                </div>
                <button
                  style={{ ...styles.button, background: '#f44336', padding: '6px 12px', fontSize: 14 }}
                  onClick={() => handleUseDiscountForUser(u.id)}
                  disabled={totals.netPoints <= 0}
                >
                  Utiliser la remise
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div style={styles.box}>
        <h3 style={styles.subtitle}>{view === 'today' ? 'Commandes du jour' : 'Toutes les commandes'}</h3>
        {view === 'today' ? (
          <>
            {orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toISOString().split('T')[0] === today).length === 0 && <p>Aucune commande.</p>}
            <ul style={styles.list}>
              {orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toISOString().split('T')[0] === today).map(o => (
                <li key={o.id} style={styles.listItem}>
                  <div>
                    <strong>{o.amount} €</strong>
                    <br />
                    <small>{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : 'Date inconnue'}</small>
                  </div>
                  <small>Client: {o.userId}</small>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {orders.length === 0 && <p>Aucune commande.</p>}
            <ul style={styles.list}>
              {orders.map(o => (
                <li key={o.id} style={styles.listItem}>
                  <div>
                    <strong>{o.amount} €</strong>
                    <br />
                    <small>{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : 'Date inconnue'}</small>
                  </div>
                  <small>Client: {o.userId}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: 20,
    fontFamily: 'sans-serif',
    maxWidth: 700,
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
