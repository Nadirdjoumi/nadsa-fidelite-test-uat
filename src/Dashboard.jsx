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
  orderBy
} from 'firebase/firestore';

const POINTS_REMISE = 10; // points à déduire lors de l'utilisation de la remise

const Dashboard = ({ user }) => {
  const [amount, setAmount] = useState('');
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]); // liste clients avec points cumulés
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [view, setView] = useState('today');
  const [actionLoading, setActionLoading] = useState({}); // uid => bool
  const [error, setError] = useState('');

  const isAdmin = user?.email === 'admin@admin.com';

  // Extraire prénom depuis user.displayName ou email
  const prenom = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
      ? user.email.split('@')[0]
      : 'Utilisateur';

  // Fonction pour calculer points et remise selon montant
  const calcPoints = montant => Math.floor(montant / 100);
  // remise = points * 1.3 arrondi à la dizaine la plus proche
  const calcRemise = points => Math.round(points * 1.3 / 10) * 10;

  // Ajouter une commande
  const handleAddOrder = async () => {
    if (!amount || isNaN(amount)) return;
    setLoading(true);

    const montantInt = Math.floor(parseFloat(amount)); // arrondi sans décimales
    const points = calcPoints(montantInt);
    const remise = calcRemise(points);

    try {
      await addDoc(collection(db, 'orders'), {
        userId: user.uid,
        amount: montantInt,
        points,
        remise,
        createdAt: Timestamp.now()
      });
      setAmount('');
      await fetchOrders();
      if (isAdmin) await fetchClientsWithPoints();
    } catch (e) {
      alert('Erreur ajout commande : ' + e.message);
    }
    setLoading(false);
  };

  // Récupérer commandes selon utilisateur ou admin
  const fetchOrders = async () => {
    setLoading(true);
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    } catch (e) {
      alert('Erreur chargement commandes : ' + e.message);
    }
    setLoading(false);
  };

  // Récupérer liste clients et calculer leurs points cumulés depuis commandes
  const fetchClientsWithPoints = async () => {
    setLoadingClients(true);
    setError('');
    try {
      // 1. Récupérer tous les users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

      // 2. Récupérer toutes les commandes (pour calcul points)
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const ordersList = ordersSnap.docs.map(d => d.data());

      // 3. Calcul points cumulés par userId
      const pointsParUser = {};
      ordersList.forEach(o => {
        if (!o.userId) return;
        pointsParUser[o.userId] = (pointsParUser[o.userId] || 0) + (o.points || 0);
      });

      // 4. Ajouter points cumulés à usersList
      const usersWithPoints = usersList.map(u => ({
        ...u,
        pointsCumul: pointsParUser[u.uid] || 0,
      }));

      setClients(usersWithPoints);
    } catch (e) {
      setError('Erreur chargement clients : ' + e.message);
    }
    setLoadingClients(false);
  };

  // Utiliser la remise (admin) : déduire POINTS_REMISE points en créant une commande "remise négative"
  const utiliserRemise = async (uid) => {
    if (actionLoading[uid]) return; // bloquer double clic
    setActionLoading(prev => ({ ...prev, [uid]: true }));
    setError('');

    try {
      // Trouver client dans clients
      const client = clients.find(c => c.uid === uid);
      if (!client) throw new Error('Client non trouvé');

      if ((client.pointsCumul || 0) < POINTS_REMISE) {
        alert(`Le client ${client.prenom || uid} n'a pas assez de points pour utiliser la remise.`);
        setActionLoading(prev => ({ ...prev, [uid]: false }));
        return;
      }

      // Créer une commande négative dans Firestore pour déduire les points
      // amount = 0 (pas de montant), points = -POINTS_REMISE, remise calculée à 0 (ou négative si tu veux)
      await addDoc(collection(db, 'orders'), {
        userId: uid,
        amount: 0,
        points: -POINTS_REMISE,
        remise: 0,
        createdAt: Timestamp.now(),
        description: 'Utilisation remise admin'
      });

      // Recharger liste clients pour mise à jour points
      await fetchClientsWithPoints();
      alert(`Remise utilisée avec succès pour ${client.prenom || uid} (-${POINTS_REMISE} points).`);
    } catch (e) {
      setError('Erreur lors de l\'utilisation de la remise : ' + e.message);
    }
    setActionLoading(prev => ({ ...prev, [uid]: false }));
  };

  const logout = () => {
    signOut(auth);
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
      if (isAdmin) fetchClientsWithPoints();
    }
  }, [user]);

  // Calcul dates
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Filtrer commandes du jour
  const todayOrders = orders.filter(o => {
    if (!o.createdAt?.toDate) return false;
    const orderDate = o.createdAt.toDate();
    return orderDate >= startOfToday;
  });

  // Total aujourd’hui (utilisateur seulement)
  const totalToday = todayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

  // Points cumulés (depuis début) pour utilisateur (pas admin)
  const totalPoints = orders.reduce((sum, o) => sum + (o.points || 0), 0);

  // Remise cumulée (depuis début) pour utilisateur
  const totalRemise = orders.reduce((sum, o) => sum + (o.remise || 0), 0);

  // Affichage commandes selon rôle + vue admin
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
              style={{ ...styles.button, backgroundColor: view === 'today' ? '#7B2233' : '#ccc', width: 150 }}
            >
              Commandes du jour
            </button>
            <button
              onClick={() => setView('all')}
              style={{ ...styles.button, backgroundColor: view === 'all' ? '#7B2233' : '#ccc', width: 150 }}
            >
              Toutes les commandes
            </button>
          </div>

          <h3 style={{ ...styles.subtitle, marginTop: 20 }}>Liste des clients</h3>
          {loadingClients ? (
            <p>Chargement clients...</p>
          ) : error ? (
            <p style={{ color: 'red' }}>{error}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #7B2233' }}>
                  <th style={thStyle}>Prénom</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Points cumulés</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.uid} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={tdStyle}>{c.prenom || c.uid}</td>
                    <td style={tdStyle}>{c.email || '-'}</td>
                    <td style={tdStyle}>{c.pointsCumul}</td>
                    <td style={tdStyle}>
                      <button
                        disabled={actionLoading[c.uid] || c.pointsCumul < POINTS_REMISE}
                        onClick={() => utiliserRemise(c.uid)}
                        style={{
                          ...styles.button,
                          backgroundColor: c.pointsCumul >= POINTS_REMISE ? '#7B2233' : '#999',
                          cursor: c.pointsCumul >= POINTS_REMISE ? 'pointer' : 'not-allowed',
                          padding: '5px 10px',
                          fontSize: 14,
                        }}
                      >
                        {actionLoading[c.uid] ? 'Traitement...' : 'Utiliser la remise'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={styles.subtitle}>Commandes ({view === 'today' ? 'du jour' : 'toutes'})</h3>
          {displayedOrders.length === 0 ? (
            <p>Aucune commande.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #7B2233' }}>
                  <th style={thStyle}>Utilisateur</th>
                  <th style={thStyle}>Montant</th>
                  <th style={thStyle}>Points</th>
                  <th style={thStyle}>Remise</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Description</th>
                </tr>
              </thead>
              <tbody>
                {displayedOrders.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={tdStyle}>{o.userId}</td>
                    <td style={tdStyle}>{o.amount} DA</td>
                    <td style={tdStyle}>{o.points}</td>
                    <td style={tdStyle}>{o.remise} DA</td>
                    <td style={tdStyle}>{o.createdAt?.toDate?.().toLocaleString() || '-'}</td>
                    <td style={tdStyle}>{o.description || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { maxWidth: 900, margin: 'auto', padding: 20, fontFamily: 'Arial, sans-serif' },
  title: { color: '#7B2233' },
  logout: {
    backgroundColor: '#7B2233',
    color: '#fff',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    float: 'right',
  },
  box: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  subtitle: {
    marginBottom: 10,
    color: '#7B2233',
  },
  input: {
    padding: 10,
    width: '100%',
    fontSize: 16,
    marginBottom: 10,
    borderRadius: 5,
    border: '1px solid #ddd',
  },
  button: {
    backgroundColor: '#7B2233',
    color: '#fff',
    padding: '10px 16px',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
  },
  stats: {
    marginTop: 20,
  }
};

const thStyle = { padding: 10, textAlign: 'left', color: '#7B2233' };
const tdStyle = { padding: 8 };

export default Dashboard;
