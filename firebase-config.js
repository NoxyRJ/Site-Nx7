// ============================================================
//  firebase-config.js — cole aqui os dados do SEU projeto
//  Firebase Console > Configurações do projeto > Seus apps > Web (</>)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

export const ADMIN_EMAIL = "SEU-EMAIL@gmail.com";   // o MESMO e-mail das regras de segurança
export const DISCORD_CLIENT_ID = "";                // Client ID do app no Discord Developer Portal

const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI.firebaseapp.com",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI.firebasestorage.app",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
