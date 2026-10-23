import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

export const ADMIN_EMAIL = "thiagocoelhodavos@gmail.com";   // o MESMO e-mail das regras de segurança
export const DISCORD_CLIENT_ID = "1563033920201556042";    // Client ID do app no Discord Developer Portal

const firebaseConfig = {
  apiKey: "AIzaSyCYOq63F5LjnfrBzBuCzFG1oWcfB4o6sx0",
  authDomain: "nx7-site.firebaseapp.com",
  projectId: "nx7-site",
  storageBucket: "nx7-site.firebasestorage.app",
  messagingSenderId: "591912733196",
  appId: "1:591912733196:web:07e3fa01a392d019b4bc29",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
