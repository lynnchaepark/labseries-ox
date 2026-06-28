import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYG9bQoDqxvWWX3mteFJo_4Oxp029SIm8",
  authDomain: "labseries-ox.firebaseapp.com",
  projectId: "labseries-ox",
  storageBucket: "labseries-ox.firebasestorage.app",
  messagingSenderId: "889787435877",
  appId: "1:889787435877:web:be840874b87a226225af8c"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const GAME_ID = "main";
