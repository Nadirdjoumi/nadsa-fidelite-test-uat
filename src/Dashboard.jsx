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
  
  const [adminMontant, setAdminMontant] = useState('');
  const [addingMontant, setAddingMontant] = useState(false);

  const isAdmin = user?.email === 'admin@admin.com';

  const prenom = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
    ? user.email.split('@')[0]
    : 'Utilisateur';

  const calcPoints = montant => Math.floor(montant / 100);
  const calcRemise = points => Math.round((points * 2.7) / 10) * 10;

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
  
  // Fonction pour ajouter une commande à un client
  const handleAddMontantToClient = async () => {
  if (!selectedClient || isNaN(adminMontant) || !adminMontant) return;

  setAddingMontant(true);

  const montantInt = Math.floor(parseFloat(adminMontant));
  const points = calcPoints(montantInt);
  const remise = calcRemise(points);

  await addDoc(collection(db, 'orders'), {
    userId: selectedClient.userId,
    userEmail: '', // si tu veux, tu peux stocker l'email du client ici
    amount: montantInt,
    points,
    remise,
    createdAt: Timestamp.now(),
  });

  setAdminMontant('');
  await handleSelectClient(selectedClient.userId);
  await fetchOrders();

  setAddingMontant(false);
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
              {selectedClient.orders.map(order => (
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
            onClick={handleUseRemise}
            disabled={loadingRemise}
            style={{ ...styles.button, marginBottom: 10 }}
          >
            {loadingRemise ? 'Traitement...' : 'Utiliser la remise'}
          </button>
		  
<div style={{ marginBottom: 10 }}>
  <input
    type="number"
    placeholder="Ajouter un montant"
    value={adminMontant}
    onChange={e => setAdminMontant(e.target.value)}
    style={styles.input}
  />
  <button
    onClick={handleAddMontantToClient}
    disabled={addingMontant}
    style={{ ...styles.button, backgroundColor: '#227B33', marginTop: 5 }}
  >
    {addingMontant ? 'Ajout en cours...' : 'Ajouter ce montant'}
  </button>
</div>

		  
          <button
            onClick={() => setSelectedClient(null)}
            style={{ ...styles.button, backgroundColor: '#999' }}
          >
            OK
          </button>
        </div>
      )}

      {!isAdmin && (
        <div style={styles.box}>
          <h3 style={styles.subtitle}>Mes Points NADSA</h3>
          <div style={styles.stats}>
            <p><strong>Mon Total aujourd'hui :</strong> {totalToday} DA</p>
            <p><strong>Mes Points cumulés :</strong> {totalPoints} pts</p>
            <p><strong>Ma Remise obtenue :</strong> {totalRemise} DA</p>
          </div>
        </div>
      )}

      {isAdmin && !selectedClient && (
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
                  <small>{o.createdAt?.toDate?.().toLocaleString() || 'Date inconnue'}</small>
                </div>
              </li>
            ))}
          </ul>
        )}

        {isAdmin &&
          Object.entries(groupedByUser).map(([userId, userOrders]) => (
            <div key={userId} style={{ marginBottom: 30 }}>

	<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#7B2233', marginBottom: 8 }}>
 
 <span>
  <strong>Client :</strong>{' '}
  <strong>{usersCache[userId] || userId}</strong>
</span>

  <span><strong>{userOrders.reduce((sum, o) => sum + (o.remise || 0), 0)} DA</strong></span>
</div>

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
                        {order.createdAt?.toDate?.().toLocaleString() || 'Date inconnue'}
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
    //padding: 20,
    fontFamily: 'Arial, sans-serif',
    minHeight: '100vh',        // Prend toute la hauteur visible
    width: '100vw',            // Prend toute la largeur visible
    padding: 16,
    boxSizing: 'border-box',
    margin: '0 auto',
    background: '#fff5f7',
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
	overflow: 'hidden',
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
