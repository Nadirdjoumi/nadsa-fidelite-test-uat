"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  getDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalRemise, setTotalRemise] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientOrders, setClientOrders] = useState([]);

  const isAdmin = user?.email === 'admin@admin.fr';

  useEffect(() => {
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    const fetchAllUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersList);
    };
    fetchAllUsers();
  }, []);

  useEffect(() => {
    if (user && !isAdmin) {
      fetchUserStats(user.uid);
    }
  }, [user]);

  const fetchUserStats = async (userId) => {
    const q = query(collection(db, 'orders'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(doc => doc.data());

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(order => order.createdAt.toDate() >= today);
    const totalToday = todayOrders.reduce((sum, order) => sum + order.amount, 0);
    const totalPoints = orders.reduce((sum, order) => sum + order.points, 0);
    const totalRemise = orders.reduce((sum, order) => sum + order.remise, 0);

    setTotalToday(totalToday);
    setTotalPoints(totalPoints);
    setTotalRemise(totalRemise);
  };

  const handleAddOrderAdmin = async (targetUserId, targetEmail) => {
    if (!amount || isNaN(amount)) return;
    setLoading(true);

    const montantInt = Math.floor(parseFloat(amount));
    const points = calcPoints(montantInt);
    const remise = calcRemise(points);

    await addDoc(collection(db, 'orders'), {
      userId: targetUserId,
      userEmail: targetEmail,
      amount: montantInt,
      points,
      remise,
      createdAt: Timestamp.now(),
    });

    setAmount('');
    await handleSelectClient(targetUserId);
    setLoading(false);
  };

  const handleUseRemise = async () => {
    if (!selectedClient) return;

    const userRef = doc(db, 'users', selectedClient.userId);
    await updateDoc(userRef, { usedRemise: selectedClient.totalRemise });

    await handleSelectClient(selectedClient.userId);
  };

  const calcPoints = (amount) => {
    if (amount >= 10000) return 100;
    if (amount >= 5000) return 50;
    if (amount >= 1000) return 10;
    return 0;
  };

  const calcRemise = (points) => {
    if (points >= 100) return 1000;
    if (points >= 50) return 400;
    if (points >= 10) return 50;
    return 0;
  };

  const handleSelectClient = async (userId) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    const q = query(collection(db, 'orders'), where('userId', '==', userId));
    const ordersSnap = await getDocs(q);
    const orders = ordersSnap.docs.map(doc => doc.data());

    const totalPoints = orders.reduce((sum, o) => sum + o.points, 0);
    const totalRemise = orders.reduce((sum, o) => sum + o.remise, 0);
    const usedRemise = userData.usedRemise || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalToday = orders.filter(o => o.createdAt.toDate() >= today).reduce((sum, o) => sum + o.amount, 0);

    setSelectedClient({
      name: userData.email,
      userId,
      totalPoints,
      totalRemise: totalRemise - usedRemise,
      totalToday,
    });
    setClientOrders(orders);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Tableau de bord</h2>

      {!isAdmin && (
        <div style={styles.box}>
          <h3 style={styles.subtitle}>Mes informations</h3>
          <div style={styles.stats}>
            <p><strong>Total aujourd'hui :</strong> {totalToday} DA</p>
            <p><strong>Points cumulés :</strong> {totalPoints} pts</p>
            <p><strong>Remise obtenue :</strong> {totalRemise} DA</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div style={styles.box}>
          <h3 style={styles.subtitle}>Rechercher un client</h3>
          <input
            type="text"
            placeholder="Nom ou email"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.input}
          />
          {search.length > 1 && (
            <ul style={styles.list}>
              {allUsers.filter(u => u.email.includes(search)).map(u => (
                <li key={u.id} onClick={() => handleSelectClient(u.id)} style={styles.listItem}>
                  {u.email}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isAdmin && selectedClient && (
        <div style={styles.box}>
          <h3 style={styles.subtitle}>Client : {selectedClient.name}</h3>
          <p>Total aujourd'hui : {selectedClient.totalToday} DA</p>
          <p>Points cumulés : {selectedClient.totalPoints}</p>
          <p>Remise disponible : {selectedClient.totalRemise} DA</p>

          <div style={{ marginTop: 15 }}>
            <h4>Ajouter une commande</h4>
            <input
              type="number"
              placeholder="Montant en DA"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={styles.input}
            />
            <button
              onClick={() => handleAddOrderAdmin(selectedClient.userId, selectedClient.name)}
              style={styles.button}
              disabled={loading}
            >
              {loading ? 'Ajout en cours...' : 'Ajouter'}
            </button>
          </div>

          <button onClick={handleUseRemise} style={{ ...styles.button, backgroundColor: '#f44336' }}>
            Utiliser la remise
          </button>

          <h4 style={{ marginTop: 20 }}>Historique des commandes</h4>
          <ul>
            {clientOrders.map((order, index) => (
              <li key={index}>
                {order.amount} DA - {order.points} pts - {order.remise} DA remise
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: 20,
    maxWidth: 600,
    margin: 'auto',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  box: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: 30,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    padding: 10,
    width: '100%',
    marginBottom: 15,
    borderRadius: 5,
    border: '1px solid #ccc',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    marginTop: 10,
    maxHeight: 150,
    overflowY: 'auto',
    border: '1px solid #ccc',
    borderRadius: 5,
  },
  listItem: {
    padding: 10,
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
  },
  stats: {
    lineHeight: 1.8,
  },
};

export default Dashboard;
