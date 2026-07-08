import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYG9bQoDqxvWWX3mteFJo_4Oxp029SIm8",
  authDomain: "labseries-ox.firebaseapp.com",
  projectId: "labseries-ox",
  storageBucket: "labseries-ox.firebasestorage.app",
  messagingSenderId: "889787435877",
  appId: "1:889787435877:web:be840874b87a226225af8c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, setDoc, getDoc, onSnapshot, collection, getDocs, deleteDoc, serverTimestamp };
