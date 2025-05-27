import React, { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { useAuth } from './AuthContext';
import OrderForm from './OrderForm';

const Dashboard = () => {
  const { currentUser, role } = useAuth();
  const [orders, setOrders] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalRemise, setTotalRemise] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Nouveaux états pour la recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientsWithOrders, setClientsWithOrders] = useState({});

  const fetchOrders = async () => {
    setLoading(true);
    const querySnapshot = await getDocs(collection(db, 'orders'));
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (role === 'admin') {
      setIsAdmin(true);
      const usersCache = {};
      for (const order of data) {
        if (!usersCache[order.userId]) {
          const userDoc = await getDoc(doc(db, 'users', order.userId));
          usersCache[order.userId] = userDoc.exists()
            ? userDoc.data().name || userDoc.data().email
            : 'Inconnu';
        }
      }

      const clients = {};
      for (const order of data) {
        if (!clients[order.userId]) {
          clients[order.userId] = {
            name: usersCache[order.userId] || order.userEmail || 'Inconnu',
            orders: [],
            totalPoints: 0,
            totalRemise: 0,
          };
        }
        clients[order.userId].orders.push(order);
        clients[order.userId].totalPoints += order.points || 0;
        clients[order.userId].totalRemise += order.remise || 0;
      }
      setClientsWithOrders(clients);
    } else {
      const userOrders = data.filter(
        (order) => order.userId === currentUser.uid
      );
      setOrders(userOrders);
      const totalPts = userOrders.reduce((sum, order) => sum + (order.points || 0), 0);
      const totalRms = userOrders.reduce((sum, order) => sum + (order.remise || 0), 0);
      setTotalPoints(totalPts);
      setTotalRemise(totalRms);
    }

    setLoading(false);
  };

  const handleUseRemise = async (userId) => {
    const userOrders = clientsWithOrders[userId]?.orders || [];

    for (const order of userOrders) {
      await addDoc(collection(db, 'orders'), {
        userId,
        userEmail: order.userEmail,
        amount: 0,
        points: -order.points,
        remise: -order.remise,
        createdAt: Timestamp.now(),
      });
    }

    setSelectedClientId(null);
    fetchOrders();
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Tableau de bord</h1>
      <button onClick={handleLogout} style={styles.button}>
        Se déconnecter
      </button>

      {isAdmin && (
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Rechercher un client par nom ou prénom"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...styles.input, width: '100%' }}
          />
          {searchTerm && (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
              {Object.entries(clientsWithOrders)
                .filter(([_, info]) =>
                  info.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(([userId, info]) => (
                  <li
                    key={userId}
                    onClick={() => {
                      setSelectedClientId(userId);
                      setSearchTerm('');
                    }}
                    style={{
                      background: '#f7d9dc',
                      padding: 10,
                      marginBottom: 5,
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    {info.name}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {isAdmin && selectedClientId && (
        <div style={styles.box}>
          <h3 style={styles.subtitle}>Détails client</h3>
          <p><strong>Nom :</strong> {clientsWithOrders[selectedClientId]?.name}</p>
          <p><strong>Points :</strong> {clientsWithOrders[selectedClientId]?.totalPoints}</p>
          <p><strong>Remise :</strong> {clientsWithOrders[selectedClientId]?.totalRemise} DA</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ background: '#f7d9dc', color: '#7B2233' }}>
                <th style={styles.th}>Montant</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Points</th>
                <th style={styles.th}>Remise</th>
              </tr>
            </thead>
            <tbody>
              {clientsWithOrders[selectedClientId]?.orders.map(order => (
                <tr key={order.id}>
                  <td style={styles.td}>{order.amount} DA</td>
                  <td style={styles.td}>
                    {order.createdAt?.toDate?.().toLocaleString() || 'Date inconnue'}
                  </td>
                  <td style={styles.td}>{order.points}</td>
                  <td style={styles.td}>{order.remise} DA</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={() => handleUseRemise(selectedClientId)}
            style={{ ...styles.button, backgroundColor: '#FF5733', marginTop: 20 }}
          >
            Utiliser la remise
          </button>

          <button
            onClick={() => setSelectedClientId(null)}
            style={{ ...styles.button, backgroundColor: '#ccc', color: '#333', marginTop: 10 }}
          >
            OK
          </button>
        </div>
      )}

      {!isAdmin && (
        <>
          <OrderForm fetchOrders={fetchOrders} />
          <div style={styles.box}>
            <h3 style={styles.subtitle}>Historique des commandes</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7d9dc', color: '#7B2233' }}>
                  <th style={styles.th}>Montant</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Points</th>
                  <th style={styles.th}>Remise</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td style={styles.td}>{order.amount} DA</td>
                    <td style={styles.td}>
                      {order.createdAt?.toDate?.().toLocaleString() || 'Date inconnue'}
                    </td>
                    <td style={styles.td}>{order.points}</td>
                    <td style={styles.td}>{order.remise} DA</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={styles.total}>Total Points: {totalPoints}</p>
            <p style={styles.total}>Total Remise: {totalRemise} DA</p>
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: 800,
    margin: '0 auto',
    padding: 20,
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    textAlign: 'center',
    color: '#7B2233',
  },
  subtitle: {
    color: '#7B2233',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#7B2233',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    marginBottom: 20,
    borderRadius: 5,
  },
  input: {
    padding: '10px',
    marginBottom: 10,
    borderRadius: 5,
    border: '1px solid #ccc',
  },
  box: {
    backgroundColor: '#f7d9dc',
    padding: 20,
    borderRadius: 10,
  },
  th: {
    padding: 10,
    borderBottom: '1px solid #ccc',
    textAlign: 'left',
  },
  td: {
    padding: 10,
    borderBottom: '1px solid #eee',
  },
  total: {
    fontWeight: 'bold',
    marginTop: 10,
  },
};

export default Dashboard;
