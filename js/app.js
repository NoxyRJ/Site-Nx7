// ============================================================
//  app.js — telas (SPA), modais, login, painel (cliente/admin) e perfil
//  + AUTH WALL: o site só aparece depois que o Firebase confirma o login.
// ============================================================
import { auth, DISCORD_CLIENT_ID, ADMIN_EMAIL } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, signInWithCustomToken,
  updateProfile, deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { PRODUTOS, criarTicket, ouvirTickets, ouvirMensagens, enviarMensagem, definirStatus,
  enviarAvatar, excluirDadosDoUsuario } from "./db.js";

const $ = (s) => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const REDIRECT = location.origin + "/";

/* ---------- garantia: carrega o CSS do Auth Wall mesmo se o <link> faltar no index.html ---------- */
(() => {
  const r = document.documentElement;
  r.classList.add("gate", "loading");
  if (document.querySelector('link[href*="auth-gate.css"], style#auth-gate-css')) return; // já está no <head>: nada a fazer
  r.style.visibility = "hidden"; // evita mostrar o site "pelado" até o CSS chegar
  const l = document.createElement("link"); l.rel = "stylesheet";
  l.href = new URL("../css/auth-gate.css", import.meta.url).href; // css/ fica ao lado de js/
  const show = () => { r.style.visibility = ""; };
  l.onload = show;
  l.onerror = () => { show(); console.error("auth-gate.css NÃO encontrado em: " + l.href); };
  document.head.append(l);
})();
let user = null, isAdmin = false, adminMode = false, unsubT = null, unsubM = null,
    tickets = [], cur = null, buyKey = null, signup = false, dcPending = false;

/* ---------- modais ---------- */
const sync = () => document.body.classList.toggle("noscroll", !!document.querySelector(".mdl:not([hidden]),.tv:not([hidden])"));
const open = (id) => { $(id).hidden = false; sync(); };
const close = (id) => { $(id).hidden = true; sync(); };
// o modal de login é obrigatório enquanto não houver sessão: não fecha por X, fundo ou Esc
const locked = (m) => m.id === "loginModal" && !user;
document.addEventListener("click", (e) => {
  const m = e.target.closest?.(".mdl");
  if (m && !locked(m) && (e.target.hasAttribute("data-close") || e.target === m)) { m.hidden = true; sync(); }
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") { document.querySelectorAll(".mdl").forEach((m) => { if (!locked(m)) m.hidden = true; }); sync(); }
});
const openLogin = () => { $("#loginErr").textContent = ""; open("#loginModal"); };

/* ---------- AUTH WALL ---------- */
const root = document.documentElement; // as classes .gate/.loading vivem no <html> (ver css/auth-gate.css)

// Bloqueia o site: limpa qualquer estado da sessão anterior e deixa só o login visível.
function lockSite(msg = "") {
  unsubT?.(); unsubM?.(); unsubT = unsubM = null;
  tickets = []; cur = null; buyKey = null; adminMode = false;
  closeMenu();
  document.querySelectorAll(".mdl").forEach((m) => (m.hidden = true));
  $("#ticketsView").hidden = true;
  $("#emailForm").reset(); signup = false;
  $("#emSubmit").textContent = "Entrar"; $("#emSwitch").textContent = "Não tem conta? Cadastre-se";
  scrollTo(0, 0);
  root.classList.add("gate"); root.classList.remove("loading");
  $("#loginModal .mdl-x").hidden = true; // login obrigatório: sem "X" (reforço do CSS)
  open("#loginModal"); $("#loginErr").textContent = msg;
}
// Libera o site (só chamado quando o Firebase confirma um usuário logado).
function unlockSite() {
  close("#loginModal"); $("#emailForm").reset(); $("#loginErr").textContent = "";
  root.classList.remove("gate", "loading");
  scrollTo(0, 0);
}
// Rede de segurança: se o Firebase não responder, não deixa o loader eterno.
const wallTimer = setTimeout(() => { if (root.classList.contains("loading") && !dcPending) lockSite("Conexão lenta. Tente entrar novamente."); }, 8000);

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
  dcPending = true; // mantém o loader até o login do Discord terminar (evita piscar a tela de login)
  sessionStorage.removeItem("dc_state"); history.replaceState(null, "", location.pathname);
  fetch("/.netlify/functions/discord-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
    .then((r) => r.json()).then((j) => { if (!j.token) throw 0; return signInWithCustomToken(auth, j.token); })
    .catch(() => { dcPending = false; if (!user) lockSite("Falha no login com Discord."); });
})();

/* ---------- avatar padrão ---------- */
const DEFAULT_AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#6d28d9'/><stop offset='1' stop-color='#c084fc'/></linearGradient><radialGradient id='h' cx='.3' cy='.2' r='.9'><stop offset='0' stop-color='#fff' stop-opacity='.3'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs><rect width='96' height='96' fill='url(#g)'/><rect width='96' height='96' fill='url(#h)'/><circle cx='48' cy='37' r='15' fill='#fff' fill-opacity='.93'/><path d='M18 88c2-19 15-29 30-29s28 10 30 29z' fill='#fff' fill-opacity='.93'/></svg>`);
const avatarOf = (u) => (u?.photoURL && /^https:\/\//.test(u.photoURL) ? u.photoURL : DEFAULT_AVATAR);
const setImg = (img, src) => { img.onerror = () => { img.onerror = null; img.src = DEFAULT_AVATAR; }; img.referrerPolicy = "no-referrer"; img.src = src; };

/* ---------- navbar: avatar + menu ---------- */
const menu = $("#accMenu");
const closeMenu = () => { menu.hidden = true; $("#accBtn").setAttribute("aria-expanded", "false"); };
const toggleMenu = () => {
  const show = menu.hidden; menu.hidden = !show; $("#accBtn").setAttribute("aria-expanded", String(show));
  if (show) document.querySelector("nav").classList.remove("open"); // fecha o menu hambúrguer
};
function renderNav() {
  const src = avatarOf(user);
  setImg($("#accImg"), src); setImg($("#accMenuImg"), src);
  $("#accName").textContent = user ? user.displayName || (user.email || "Cliente").split("@")[0] : "";
  $("#accMail").textContent = user?.email || "";
  $("#adminBtn").hidden = !isAdmin;
  if (!user) closeMenu();
}
$("#accBtn").onclick = (e) => { e.stopPropagation(); if (user) toggleMenu(); };
document.addEventListener("click", (e) => { if (!e.target.closest("#acc")) closeMenu(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
$("#mb")?.addEventListener("click", closeMenu);
$("#miProfile").onclick = () => { closeMenu(); openProfile(); };
$("#miTickets").onclick = () => { closeMenu(); openTickets(false); };
$("#adminBtn").onclick = () => { closeMenu(); openTickets(true); };
$("#miOut").onclick = () => { closeMenu(); signOut(auth); }; // o onAuthStateChanged abaixo devolve para a tela de login
renderNav();

// ÚNICA fonte de verdade da tela: o site só é liberado aqui, quando o Firebase confirma o usuário.
onAuthStateChanged(auth, (u) => {
  clearTimeout(wallTimer);
  user = u; isAdmin = !!u && u.email === ADMIN_EMAIL && u.emailVerified; // só a interface; as regras do Firebase é que protegem
  renderNav();
  if (u) { dcPending = false; unlockSite(); }
  else if (!dcPending) lockSite(); // sem sessão (1º acesso, logout, conta excluída): volta para o login obrigatório
});
$("#tvOut").onclick = () => signOut(auth);

/* ---------- comprar -> modal de confirmação -> ticket ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("[data-buy]"); const k = a?.dataset.buy;
  if (!a || !PRODUTOS[k]) return; e.preventDefault();
  if (user) askBuy(k); // sem sessão o site nem está visível; a checagem é só por segurança
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
// "Voltar ao site": fecha só o painel de tickets (o usuário continua logado)
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

/* ---------- Meu Perfil ---------- */
let newPhoto = null, removePhoto = false, previewUrl = null;
function openProfile() {
  newPhoto = null; removePhoto = false; $("#pfErr").textContent = ""; $("#pfFile").value = "";
  $("#pfName").value = user.displayName || ""; $("#pfMail").value = user.email || "—";
  $("#pfDz").hidden = isAdmin; // a conta do dono não pode ser apagada por aqui
  setImg($("#pfImg"), avatarOf(user)); open("#profileModal");
}
// recorta no centro e reduz para 256x256 (foto leve e padronizada)
async function cropAvatar(file, size = 256) {
  const bmp = await createImageBitmap(file), s = Math.min(bmp.width, bmp.height), c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d").drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.88));
}
$("#pfFile").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) { $("#pfErr").textContent = "Escolha uma imagem PNG, JPG, WEBP ou GIF."; e.target.value = ""; return; }
  if (f.size > 10 * 1024 * 1024) { $("#pfErr").textContent = "Imagem muito grande (máx. 10 MB)."; e.target.value = ""; return; }
  $("#pfErr").textContent = ""; newPhoto = f; removePhoto = false;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(f); $("#pfImg").src = previewUrl;
};
$("#pfRemove").onclick = () => { newPhoto = null; removePhoto = true; $("#pfFile").value = ""; $("#pfImg").src = DEFAULT_AVATAR; };
$("#pfForm").onsubmit = async (e) => {
  e.preventDefault(); const b = $("#pfSave"), err = $("#pfErr"); err.textContent = ""; b.disabled = true; b.textContent = "Salvando...";
  try {
    const name = $("#pfName").value.trim();
    if (name.length < 2) throw new Error("Digite um nome com pelo menos 2 caracteres.");
    const patch = { displayName: name };
    if (newPhoto) patch.photoURL = await enviarAvatar(user.uid, await cropAvatar(newPhoto));
    else if (removePhoto) patch.photoURL = null;
    await updateProfile(user, patch);
    renderNav(); close("#profileModal");
  } catch (x) { err.textContent = x.message || "Não foi possível salvar."; }
  b.disabled = false; b.textContent = "Salvar alterações";
};

/* ---------- Excluir conta (LGPD) ---------- */
const provs = () => user.providerData.map((p) => p.providerId);
$("#pfDelete").onclick = () => {
  close("#profileModal");
  $("#dlStep1").hidden = false; $("#dlStep2").hidden = true; $("#dlConfirm").value = ""; $("#dlPass").value = "";
  $("#dlErr").textContent = ""; $("#dlGo").disabled = true; $("#dlPassWrap").hidden = !provs().includes("password");
  open("#deleteModal");
};
$("#dlNext").onclick = () => { $("#dlStep1").hidden = true; $("#dlStep2").hidden = false; $("#dlConfirm").focus(); };
$("#dlConfirm").oninput = () => { $("#dlGo").disabled = $("#dlConfirm").value.trim().toUpperCase() !== "EXCLUIR"; };
async function reautenticar() { // o Firebase exige login recente para apagar a conta
  const p = provs();
  if (p.includes("google.com")) await reauthenticateWithPopup(user, new GoogleAuthProvider());
  else if (p.includes("password")) {
    const pw = $("#dlPass").value;
    if (!pw) throw Object.assign(new Error("Digite sua senha para confirmar."), { code: "x" });
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
  } // Discord (token customizado): sem reautenticação; se o Firebase pedir, o aviso abaixo orienta
}
$("#dlGo").onclick = async () => {
  const b = $("#dlGo"), err = $("#dlErr"); err.textContent = ""; b.disabled = true; b.textContent = "Excluindo...";
  try {
    await reautenticar();
    await excluirDadosDoUsuario(user.uid);
    await deleteUser(user); // dispara onAuthStateChanged(null) -> volta para a tela de login
    alert("Sua conta e seus dados foram excluídos.");
  } catch (x) {
    err.textContent = ({ "auth/requires-recent-login": "Por segurança, saia, entre de novo e tente excluir logo em seguida.",
      "auth/invalid-credential": "Senha incorreta.", "auth/wrong-password": "Senha incorreta.", "auth/popup-closed-by-user": "Confirmação cancelada." }[x.code])
      ?? x.message ?? "Não foi possível excluir. Tente de novo.";
    b.disabled = false; b.textContent = "Excluir definitivamente";
  }
};