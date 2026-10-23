// ============================================================
//  app.js — telas (SPA), modais, login e painel (cliente/admin)
// ============================================================
import { auth, DISCORD_CLIENT_ID, ADMIN_EMAIL } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, signInWithCustomToken }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { PRODUTOS, criarTicket, ouvirTickets, ouvirMensagens, enviarMensagem, definirStatus } from "./db.js";

const $ = (s) => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const REDIRECT = location.origin + "/";
let user = null, isAdmin = false, adminMode = false, unsubT = null, unsubM = null,
    tickets = [], cur = null, pendingBuy = null, buyKey = null, signup = false;

/* ---------- modais ---------- */
const sync = () => document.body.classList.toggle("noscroll", !!document.querySelector(".mdl:not([hidden]),.tv:not([hidden])"));
const open = (id) => { $(id).hidden = false; sync(); };
const close = (id) => { $(id).hidden = true; sync(); };
document.addEventListener("click", (e) => {
  const m = e.target.closest?.(".mdl");
  if (m && (e.target.hasAttribute("data-close") || e.target === m)) { m.hidden = true; sync(); }
});
addEventListener("keydown", (e) => { if (e.key === "Escape") { document.querySelectorAll(".mdl").forEach((m) => (m.hidden = true)); sync(); } });
const openLogin = () => { $("#loginErr").textContent = ""; open("#loginModal"); };

/* ---------- login ---------- */
const erro = (c) => ({ "auth/invalid-credential": "E-mail ou senha incorretos.", "auth/email-already-in-use": "Este e-mail já tem conta. Use Entrar.",
  "auth/weak-password": "Senha muito curta (mínimo 6).", "auth/popup-closed-by-user": "", "auth/invalid-email": "E-mail inválido." }[c] ?? "Não foi possível entrar. Tente de novo.");
const falha = (e) => { $("#loginErr").textContent = erro(e.code); };
$("#gBtn").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(falha);
$("#dBtn").onclick = () => {
  if (!DISCORD_CLIENT_ID) { $("#loginErr").textContent = "Login com Discord ainda não configurado."; return; }
  const state = crypto.randomUUID(); sessionStorage.setItem("dc_state", state);
  location.href = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=code&scope=identify&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT)}`;
};
$("#emailForm").onsubmit = (e) => {
  e.preventDefault(); const em = $("#emEmail").value.trim(), pw = $("#emPass").value;
  (signup ? createUserWithEmailAndPassword(auth, em, pw) : signInWithEmailAndPassword(auth, em, pw)).catch(falha);
};
$("#emSwitch").onclick = (e) => { e.preventDefault(); signup = !signup;
  $("#emSubmit").textContent = signup ? "Criar conta" : "Entrar";
  e.target.textContent = signup ? "Já tem conta? Entrar" : "Não tem conta? Cadastre-se"; };
$("#emReset").onclick = (e) => { e.preventDefault(); const em = $("#emEmail").value.trim();
  if (!em) { $("#loginErr").textContent = "Digite seu e-mail acima."; return; }
  sendPasswordResetEmail(auth, em).then(() => ($("#loginErr").textContent = "Enviamos o link de redefinição.")).catch(falha); };
// volta do Discord (?code=...&state=...) -> função do Netlify devolve um token do Firebase
(() => {
  const q = new URLSearchParams(location.search), code = q.get("code");
  if (!code || q.get("state") !== sessionStorage.getItem("dc_state")) return;
  sessionStorage.removeItem("dc_state"); history.replaceState(null, "", location.pathname);
  fetch("/.netlify/functions/discord-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
    .then((r) => r.json()).then((j) => { if (!j.token) throw 0; return signInWithCustomToken(auth, j.token); })
    .catch(() => { openLogin(); $("#loginErr").textContent = "Falha no login com Discord."; });
})();

/* ---------- navbar + estado de login ---------- */
function renderNav() {
  const b = $("#accBtn"); b.replaceChildren();
  if (user) {
    if (user.photoURL) { const i = el("img"); i.src = user.photoURL; i.alt = ""; i.referrerPolicy = "no-referrer"; b.append(i); }
    b.append(el("span", "", "Meu Painel"), el("small", "un", (user.displayName || user.email || "").split(" ")[0]));
  } else b.textContent = "Entrar / Minha Conta";
  $("#adminBtn").hidden = !isAdmin;
}
onAuthStateChanged(auth, (u) => {
  user = u; isAdmin = !!u && u.email === ADMIN_EMAIL && u.emailVerified; // só a interface; as regras do Firebase é que protegem
  renderNav();
  if (u) { close("#loginModal"); if (pendingBuy) { const k = pendingBuy; pendingBuy = null; askBuy(k); } }
  else closeTickets();
});
$("#accBtn").onclick = () => (user ? openTickets(false) : openLogin());
$("#adminBtn").onclick = () => openTickets(true);
$("#tvOut").onclick = () => signOut(auth);

/* ---------- comprar -> modal de confirmação -> ticket ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("[data-buy]"); const k = a?.dataset.buy;
  if (!a || !PRODUTOS[k]) return; e.preventDefault();
  if (!user) { pendingBuy = k; openLogin(); } else askBuy(k);
});
function askBuy(k) {
  buyKey = k; $("#buyName").textContent = PRODUTOS[k].nome; $("#buyPrice").textContent = `R$ ${PRODUTOS[k].preco},00`; open("#buyModal");
}
$("#buyOk").onclick = async () => {
  const b = $("#buyOk"); b.disabled = true;
  try { const id = await criarTicket(user, buyKey); close("#buyModal"); openTickets(false, id); }
  catch (e) { alert("Não foi possível criar o ticket: " + e.message); }
  b.disabled = false;
};

/* ---------- Meus Tickets / Painel Admin ---------- */
const ms = (t) => t?.toMillis?.() ?? Date.now();
const fmt = (t) => (t?.toDate ? t.toDate().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
function openTickets(admin, select) {
  adminMode = admin; cur = null; $("#tvTitle").textContent = admin ? "Painel Admin" : "Meus Tickets";
  $("#tvMe").textContent = user.displayName || user.email || ""; $("#ticketsView").classList.remove("open"); resetChat(); open("#ticketsView");
  unsubT?.(); unsubT = ouvirTickets(user, admin, (l) => {
    tickets = l.sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt));
    if (select) { const t = tickets.find((x) => x.id === select); if (t) { select = null; return pick(t); } }
    if (cur) cur = tickets.find((x) => x.id === cur.id) || cur; head(); renderList();
  });
}
function closeTickets() { unsubT?.(); unsubM?.(); unsubT = unsubM = null; cur = null; $("#ticketsView").hidden = true; sync(); }
$("#tvBack").onclick = closeTickets;
$("#chBack").onclick = () => $("#ticketsView").classList.remove("open");
function renderList() {
  const box = $("#tvList"); box.replaceChildren();
  if (!tickets.length) box.append(el("p", "empty", adminMode ? "Nenhum ticket ainda." : "Você ainda não tem tickets. Clique em Comprar em um plano."));
  tickets.forEach((t) => {
    const b = el("button", "tk-i" + (cur?.id === t.id ? " on" : "")); b.type = "button";
    const s = el("small"); s.append(el("span", "", (adminMode ? t.userName + " · " : "") + fmt(t.updatedAt)), el("span", "stt " + t.status, t.status));
    b.append(el("b", "", t.productName), s); b.onclick = () => pick(t); box.append(b);
  });
}
function head() {
  $("#chTitle").textContent = cur ? cur.productName + (adminMode ? " · " + cur.userName : "") : "Selecione um ticket";
  const s = $("#chStatus"); s.textContent = cur?.status || ""; s.className = "stt " + (cur?.status || "");
  $("#admTools").hidden = !(adminMode && isAdmin && cur); $("#chatForm").hidden = !cur;
}
function resetChat() { $("#chatBox").replaceChildren(); head(); }
function pick(t) {
  cur = t; head(); renderList(); $("#ticketsView").classList.add("open"); unsubM?.();
  unsubM = ouvirMensagens(t.id, renderMsgs);
}
function linkify(p, text) {
  text.split(/(https?:\/\/[^\s<]+)/g).forEach((s, i) => {
    if (i % 2) { const a = el("a", "", s); a.href = s; a.target = "_blank"; a.rel = "noopener noreferrer"; p.append(a); } else p.append(s);
  });
}
function renderMsgs(list) {
  const box = $("#chatBox"); box.replaceChildren();
  list.forEach((m) => {
    const row = el("div", "mrow"), av = el("div", "mav" + (m.isAdmin ? " adm" : ""));
    if (m.photo && /^https:\/\//.test(m.photo)) { const i = el("img"); i.src = m.photo; i.alt = ""; i.referrerPolicy = "no-referrer"; av.append(i); } else av.textContent = (m.name || "?")[0].toUpperCase();
    const body = el("div", "mb2"), h = el("div", "mh"); h.append(el("b", "", m.name || "?"));
    if (m.isAdmin) h.append(el("span", "tag", "DONO")); h.append(el("i", "", fmt(m.createdAt))); body.append(h);
    if (m.text) { const p = el("div", "mt"); linkify(p, m.text); body.append(p); }
    if (m.fileUrl && /^https:\/\//.test(m.fileUrl)) {
      if ((m.fileType || "").startsWith("image/")) { const a = el("a"); a.href = m.fileUrl; a.target = "_blank"; a.rel = "noopener"; const i = el("img", "mimg"); i.src = m.fileUrl; i.alt = m.fileName; i.loading = "lazy"; a.append(i); body.append(a); }
      else { const a = el("a", "mfile", "Baixar: " + m.fileName); a.href = m.fileUrl; a.target = "_blank"; a.rel = "noopener"; body.append(a); }
    }
    row.append(av, body); box.append(row);
  });
  box.scrollTop = box.scrollHeight;
}
$("#chFile").onchange = (e) => ($("#chFn").textContent = e.target.files[0]?.name || "");
$("#chatForm").onsubmit = async (e) => {
  e.preventDefault(); const f = $("#chFile").files[0], text = $("#chText").value.trim(); if (!cur || (!text && !f)) return;
  const b = $("#chSend"); b.disabled = true;
  try {
    await enviarMensagem(cur.id, user, { text, file: f, onProgress: (p) => ($("#chFn").textContent = Math.round(p * 100) + "%") }, isAdmin);
    $("#chText").value = ""; $("#chFile").value = ""; $("#chFn").textContent = "";
  } catch (err) { alert(err.message); }
  b.disabled = false;
};
$("#stPend").onclick = () => cur && definirStatus(cur.id, "pendente").catch((e) => alert(e.message));
$("#stDone").onclick = () => cur && definirStatus(cur.id, "concluido").catch((e) => alert(e.message));
