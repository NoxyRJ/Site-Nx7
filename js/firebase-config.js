// ============================================================
//  firebase-config.js — cole aqui os dados do SEU projeto
//  Firebase Console > Configurações do projeto > Seus apps > Web (</>)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

export const ADMIN_EMAIL = "thiagocoelhodavos@gmail.com";   // o MESMO e-mail das regras de segurança

const firebaseConfig = {
  apiKey: "AIzaSyCYOq63F5LjnfrBzBuCzFG1oWcfB4o6sx0",
  authDomain: "nx7-site.firebaseapp.com",
  projectId: "nx7-site",
  storageBucket: "nx7-site.firebasestorage.app",
  messagingSenderId: "591912733196",
  appId: "1:591912733196:web:07e3fa01a392d019b4bc29",
};

// ---- Fotos de perfil: Cloudinary (grátis, sem depender do Firebase Storage) ----
// 1) crie a conta em cloudinary.com  2) copie o "Cloud name" no Dashboard
// 3) Settings > Upload > Upload presets > Add upload preset: Signing mode = "Unsigned" > Save, e copie o nome do preset
export const CLOUDINARY = { cloud: "bln5175w", preset: "nx7_avatars" };   // ex.: { cloud: "dxyz123abc", preset: "nx7_avatars" }

// ---- Aviso de venda no Discord: Cloudflare Worker (worker.js) — grátis, sem cartão ----
// Depois de publicar o Worker, copie a URL dele (algo como
// https://notify-discord.SEU-SUBDOMINIO.workers.dev) e cole aqui.
export const NOTIFY_DISCORD_URL = "https://notift-discord.thiagocoelhodavos.workers.dev/";   // ex.: "https://notify-discord.nx7.workers.dev"

// ---- Anexos dos tickets (.zip/.rar/.7z): Supabase Storage (grátis, sem cartão) ----
// 1) crie a conta em supabase.com e um projeto  2) Storage > New bucket: nome "nx7-arquivos", marque "Public bucket"
// 3) Project Settings > API: copie a "Project URL" e a chave "anon public" (ou "publishable")
// 4) rode o SQL do passo 3 que te passei no chat (libera o envio de arquivos)
export const SUPABASE = { url: "https://azwvqmyveyegebeamrva.supabase.co", key: "sb_publishable_lNCHyzsxd8cCiKsxOcW5nQ_LJGalSv8", bucket: "nx7-arquivos" };

// ---- Cargos no Discord (vendedor / suporte / comprador): Cloudflare Worker "discord-roles-worker.js" ----
// Siga o passo a passo no topo do discord-roles-worker.js e cole aqui a URL do Worker.
// Enquanto estiver vazio ("") o site funciona normal, só não mexe nos cargos do Discord.
export const ROLES_URL = "https://discord-roles.thiagocoelhodavos.workers.dev";   // ex.: "https://discord-roles.SEU-SUBDOMINIO.workers.dev"

// ---- 2 webhooks novos: (1) chamados de SUPORTE  (2) cargo adicionado/removido pelo site ----
// Cloudflare Worker "discord-logs-worker.js" (passo a passo no topo dele). Os links dos webhooks do Discord
// ficam como SECRETS dentro do Worker — nunca cole o link do webhook aqui. Cole só a URL do Worker.
// Enquanto estiver vazio ("") tudo continua como antes (o aviso de suporte segue pelo NOTIFY_DISCORD_URL).
export const LOGS_URL = "https://discord-logs.thiagocoelhodavos.workers.dev";   // ex.: "https://discord-logs.SEU-SUBDOMINIO.workers.dev"

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);