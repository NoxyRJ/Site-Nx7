// ============================================================
//  db.js — Firestore (tickets + chat em tempo real) e Storage (arquivos)
// ============================================================
import { db, storage } from "./firebase-config.js";
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

export const PRODUTOS = {
  orbs:  { nome: "Nx7 - Orbs Automatic",  preco: 25 },
  msg:   { nome: "Nx7 - Message Manager", preco: 25 },
  combo: { nome: "Combo Nx7 Completo",    preco: 40 },
};
const EXT = /\.(zip|rar|7z|pdf|txt|png|jpe?g|gif|webp)$/i;
const MAX = 100 * 1024 * 1024; // 100 MB (igual às regras do Storage)

export async function criarTicket(user, key) {
  const p = PRODUTOS[key];
  const t = await addDoc(collection(db, "tickets"), {
    uid: user.uid, userName: user.displayName || (user.email || "Cliente").split("@")[0],
    userEmail: user.email || "", userPhoto: user.photoURL || "",
    product: key, productName: p.nome, price: p.preco, status: "pendente",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await enviarMensagem(t.id, user, { text: `Olá! Quero o pedido: ${p.nome} (R$ ${p.preco},00).` }, false);
  return t.id;
}

// admin = todos os tickets | cliente = só os dele (ordenação feita no app.js)
export function ouvirTickets(user, admin, cb) {
  const q = admin ? query(collection(db, "tickets"), orderBy("updatedAt", "desc"))
                  : query(collection(db, "tickets"), where("uid", "==", user.uid));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(e));
}

export function ouvirMensagens(ticketId, cb) {
  const q = query(collection(db, "tickets", ticketId, "messages"), orderBy("createdAt"));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(e));
}

export async function enviarMensagem(ticketId, user, { text = "", file = null, onProgress } = {}, isAdmin = false) {
  let fileUrl = null, fileName = null, fileType = null;
  if (file) {
    if (!EXT.test(file.name)) throw new Error("Envie .zip, .rar, .7z, .pdf, .txt ou imagem.");
    if (file.size > MAX) throw new Error("Arquivo maior que 100 MB.");
    const r = ref(storage, `tickets/${ticketId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`);
    const task = uploadBytesResumable(r, file);
    await new Promise((ok, err) => task.on("state_changed",
      (s) => onProgress && onProgress(s.bytesTransferred / s.totalBytes), err, ok));
    fileUrl = await getDownloadURL(r); fileName = file.name; fileType = file.type || "";
  }
  await addDoc(collection(db, "tickets", ticketId, "messages"), {
    uid: user.uid, name: user.displayName || (user.email || "Cliente").split("@")[0],
    photo: user.photoURL || "", isAdmin, text, fileUrl, fileName, fileType, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "tickets", ticketId), { updatedAt: serverTimestamp() });
}

export const definirStatus = (ticketId, status) =>
  updateDoc(doc(db, "tickets", ticketId), { status, updatedAt: serverTimestamp() }); // "pendente" | "concluido"
