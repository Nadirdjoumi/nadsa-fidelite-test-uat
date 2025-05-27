// src/firebase.js

// Import Firebase core + services que tu utilises
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ Remplace ceci par les vraies infos que Firebase t’a données
const firebaseConfig = {
  apiKey: "AIzaSyAgZwOWhw2T9nu7rUVHly407ICK4BT0oIo",
  authDomain: "nadsa-fidelite.firebaseapp.com",
  projectId: "nadsa-fidelite",
  storageBucket: "nadsa-fidelite.firebasestorage.app",
  messagingSenderId: "304170417691",
  appId: "1:304170417691:web:74c5c03b06b61bf88982be",
  measurementId: "G-SJQSRMZD4P"
};

// Initialise Firebase
const app = initializeApp(firebaseConfig);

// Exporte les modules que tu vas utiliser
export const auth = getAuth(app);
export const db = getFirestore(app);
