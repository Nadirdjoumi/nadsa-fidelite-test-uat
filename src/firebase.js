// src/firebase.js

// Import Firebase core + services que tu utilises
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ Remplace ceci par les vraies infos que Firebase t’a données
const firebaseConfig = {
  apiKey: "AIzaSyCduuI1nI0flA_dQbPlMKeoIrqrGYvgyXA",
  authDomain: "nadsa-fidelite-uat.firebaseapp.com",
  projectId: "nadsa-fidelite-uat",
  storageBucket: "nadsa-fidelite-uat.firebasestorage.app",
  messagingSenderId: "931867942247",
  appId: "1:931867942247:web:b2fb2c6e28964013d763c2"
  measurementId: "G-SJQSRMZD4P"
};

// Initialise Firebase
const app = initializeApp(firebaseConfig);

// Exporte les modules que tu vas utiliser
export const auth = getAuth(app);
export const db = getFirestore(app);
