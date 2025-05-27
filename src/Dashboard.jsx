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
  updateDoc,
} from 'firebase/firestore';

const Dashboard = ({ user }) => {
  const [amount, setAmount] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('today');
  const [usersCache, setUsersCache] = useState({});

  // Nouveaux états pour la recherche et gestion du client sélectionné
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loadingRemise, setLoadingRemise] = useState(false);

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

  // Fonction pour fetch toutes les commandes (admin ou user)
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
        if (!newCache[order.userId]) {
          try {
            const userDoc = await getDoc(doc(db, 'users', order.userId));
            if (userDoc.exists()) {
              const dataUser = userDoc.data();
              newCache[order.userId] = `${dataUser.prenom} ${dataUser.nom}`;
            } else {
              newCache[order.userId] = order.userEmail || 'Inconnu';
            }
          } catch (e) {
            newCache[order.userId] = 'Erreur';
          }
        }
      }
      setUsersCache(newCache);
    }

    setOrders(data);
    setLoading(false);
  };

  // Nouvelle fonction de recherche côté admin
  const handleSearchChange = async e => {
    const val = e.target.value;
    setSearchTerm(val);
    setSelectedClient(null); // reset sélection client

    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Recherche dans usersCache en filtrant sur prénom + nom (en minuscule)
    const lowerVal = val.toLowerCase();

    // On récupère les userIds des clients ayant commandé
    const userIdsWithOrders = [...new Set(orders.map(o => o.userId))];

    // Filtrer usersCache par recherche sur nom/prenom + userIds ayant commandé
    const filtered = userIdsWithOrders
      .map(userId => ({
        userId,
        name: usersCache[userId] || '',
      }))
      .filter(({ name }) => name.toLowerCase().includes(lowerVal));

    setSearchResults(filtered);
  };

  // Au clic sur un client dans la recherche, on récupère ses commandes et infos
  const handleSelectClient = async userId => {
    setLoading(true);
    setSelectedClient(null);

    // Récupérer commandes du client
    const q = query(collection(db, 'orders'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const userOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Récupérer infos client dans 'users'
    let clientName = usersCache[userId] || 'Inconnu';
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const dataUser = userDoc.data();
        clientName = `${dataUser.prenom} ${dataUser.nom}`;
      }
    } catch (e) {}

    // Calculer total remise et total points du client
    const totalPointsClient = userOrders.reduce((sum, o) => sum + (o.points || 0), 0);
    const totalRemiseClient = userOrders.reduce((sum, o) => sum + (o.remise || 0), 0);

    setSelectedClient({
      userId,
      name: clientName,
      orders: userOrders,
      totalPoints: totalPointsClient,
      totalRemise: totalRemiseClient,
    });

    setLoading(false);
  };

  // Fonction pour remettre à zéro la remise / points du client (utiliser la remise)
  const handleUseRemise = async () => {
    if (!selectedClient) return;
    setLoadingRemise(true);

    // Mettre à jour toutes les commandes du client à points=0 et remise=0
    // OU une autre logique métier (ici on reset toutes ses commandes ?)
    // Sinon, on peut créer une collection "usedRemises" ou autre
    // Ici on simplifie en mettant à 0 toutes les remises et points dans ses commandes

    const batchUpdates = selectedClient.orders.map(order =>
      updateDoc(doc(db, 'orders', order.id), { points: 0, remise: 0 })
    );

    await Promise.all(batchUpdates);

    // Recharge les commandes et infos client à jour
    await fetchOrders();

    // Reset sélection client et retour accueil admin
    setSelectedClient(null);
    setSearchTerm('');
    setSearchResults([]);
    setLoadingRemise(false);
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

      {/* Barre de recherche admin */}
      {isAdmin && !selectedClient && (
        <div style={{ marginBottom: 30 }}>
          <input
            type="text"
            placeholder="Rechercher un client par prénom ou nom"
            value={searchTerm}
            onChange={handleSearchChange}
            style={styles.input}
          />
          {searchResults.length > 0 && (
            <ul style={{ ...styles.list, maxHeight: 150, overflowY: 'auto', marginTop: 5 }}>
              {searchResults.map(({ userId, name }) => (
                <li
                  key={userId}
                  onClick={() => handleSelectClient(userId)}
                  style={{ 
                    ...styles.listItem, 
                    cursor: 'pointer', 
                    backgroundColor: '#ffdede',
                    textAlign: 'center',
                    color: '#7B2233'
                  }}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Détails du client sélectionné */}
      {isAdmin && selectedClient && (
        <div style={styles.box}>
          <h3 style={styles.subtitle}>Détails client : {selectedClient.name}</h3>
          <p><strong>Total points :</strong> {selectedClient.totalPoints} pts</p>
          <p><strong>Total remise :</strong> {selectedClient.totalRemise} DA</p>

          <button
            onClick={handleUseRemise}
            disabled={loadingRemise}
            style={{ ...styles.button, marginBottom: 10 }}
          >
            {loadingRemise ? 'Traitement...' : 'Utiliser la remise (remettre à zéro)'}
          </button>

          <h4>Commandes :</h4>
          {selectedClient.orders.length === 0 && <p>Aucune commande.</p>}
          <ul style={styles.list}>
            {selectedClient.orders.map(order => (
              <li key={order.id} style={styles.listItem}>
                Montant: {order.amount} DA - Points: {order.points} - Remise: {order.remise} DA
              </li>
            ))}
          </ul>

          <button onClick={() => setSelectedClient(null)} style={styles.button}>
            Retour à la recherche
          </button>
        </div>
      )}

      {!isAdmin && (
        <>
          <div style={styles.box}>
            <input
              type="number"
              placeholder="Montant de la commande en DA"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={styles.input}
            />
            <button onClick={handleAddOrder} disabled={loading || !amount} style={styles.button}>
              {loading ? 'Enregistrement...' : 'Ajouter la commande'}
            </button>
          </div>

          <div style={styles.box}>
            <h3 style={styles.subtitle}>Historique de vos commandes</h3>
            {orders.length === 0 && <p>Aucune commande pour l'instant.</p>}
            <ul style={styles.list}>
              {orders.map(order => (
                <li key={order.id} style={styles.listItem}>
                  Montant: {order.amount} DA - Points: {order.points} - Remise: {order.remise} DA -{' '}
                  {order.createdAt?.toDate
                    ? order.createdAt.toDate().toLocaleString()
                    : ''}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <div style={styles.box}>
            <h3 style={styles.subtitle}>Statistiques globales</h3>
            <p>Total aujourd'hui : {totalToday} DA</p>
            <p>Total points : {totalPoints} pts</p>
            <p>Total remise : {totalRemise} DA</p>

            <button
              onClick={() => setView(view === 'today' ? 'all' : 'today')}
              style={styles.button}
            >
              Voir {view === 'today' ? 'toutes les commandes' : 'commandes du jour'}
            </button>
          </div>

          {view === 'all' && (
            <div style={styles.box}>
              <h3 style={styles.subtitle}>Toutes les commandes</h3>
              {Object.entries(groupedByUser).map(([userId, userOrders]) => (
                <div key={userId} style={{ marginBottom: 20 }}>
                  <h4>
                    {usersCache[userId] || 'Inconnu'} ({userOrders.length} commandes)
                  </h4>
                  <ul style={styles.list}>
                    {userOrders.map(order => (
                      <li key={order.id} style={styles.listItem}>
                        Montant: {order.amount} DA - Points: {order.points} - Remise: {order.remise} DA -{' '}
                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: 800,
    margin: '20px auto',
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    textAlign: 'center',
    color: '#4a4a4a',
  },
  subtitle: {
    color: '#444',
  },
  box: {
    border: '1px solid #ddd',
    padding: 15,
    marginBottom: 20,
    borderRadius: 5,
    backgroundColor: '#fafafa',
  },
  input: {
    padding: 8,
    width: '100%',
    marginBottom: 10,
    borderRadius: 4,
    border: '1px solid #ccc',
    fontSize: 16,
  },
  button: {
    padding: '10px 15px',
    backgroundColor: '#4a90e2',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  logout: {
    position: 'absolute',
    right: 20,
    top: 20,
    backgroundColor: '#e94e4e',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  list: {
    listStyle: 'none',
    paddingLeft: 0,
  },
  listItem: {
    padding: '5px 0',
    borderBottom: '1px solid #ddd',
  },
};

export default Dashboard;
