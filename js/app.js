// ============================================================
//  app.js — telas (SPA), modais, login, painel (cliente/admin) e perfil
//  + AUTH WALL: o site só aparece depois que o Firebase confirma o login.
//  Fase 3: botão Concluído corrigido + novo design do chat.
//  Fase 4: anexos com pré-visualização, barra de progresso e cancelamento.
// ============================================================
import { auth, ADMIN_EMAIL } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, OAuthProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  updateProfile, updatePassword, deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider,
  linkWithPopup, unlink }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { Suporte } from "./support.js";
import { PRODUTOS, criarTicket, ouvirTickets, ouvirMensagens, enviarMensagem, definirStatus, reembolsarTicket,
  ouvirMeuPapel, ouvirEquipe, adicionarMembro, mudarCargo, removerMembro, ehComprador, PAPEIS, sincronizarDiscord,
  enviarAvatar, atualizarPerfilNosTickets, excluirDadosDoUsuario, validarArquivo, ARQUIVOS_ACEITOS, avisarVendaConcluida,
  registrarAuditoria, ouvirAuditoria, estatisticasConsole, verificarServicos, TIPOS_AUDITORIA } from "./db.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const STATUS_LABEL = { pendente: "Pendente", concluido: "Concluído", reembolsado: "Reembolsado" };
const brl = (v) => "R$ " + Number(v ?? 0).toFixed(2).replace(".", ",");
const fmtBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace(".", ",")} MB`;

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
    tickets = [], cur = null, buyKey = null, signup = false,
    newPhoto = null, removePhoto = false, previewUrl = null, // estado do "Meu Perfil"
    busca = "", filtro = "todos", // estado da busca/filtro do painel de tickets
    msgsCache = [], sigPerfis = ""; // últimas mensagens + assinatura dos perfis (para redesenhar quando alguém troca nome/foto)
// equipe: isAdmin = DONO (e-mail do firebase-config). papel = "dono" | "vendedor" | "suporte" | null
let papel = null, isStaff = false, meComprador = false, compChecado = false, unsubComp = null, unsubPapel = null, unsubEq = null, equipe = [];
let unsubAud = null, auditoria = [], filtroAud = "todos"; // console do dono: log de auditoria

/* ---------- notificação de resposta nova no ticket (badge + som leve) ---------- */
// "visto por último" fica só no navegador (localStorage), por conta: nunca toca no Firestore nem nas regras.
let unreadIds = new Set(), primeiraCargaNtf = true, audioCtx = null;
const seenKey = () => "nx7_seen_" + (user?.uid || "");
function lerVistos() { try { return JSON.parse(localStorage.getItem(seenKey())) || {}; } catch { return {}; } }
function marcarVisto(ticketId, quando) {
  const m = lerVistos(); m[ticketId] = quando ?? Date.now();
  try { localStorage.setItem(seenKey(), JSON.stringify(m)); } catch {}
  if (unreadIds.has(ticketId)) { unreadIds.delete(ticketId); atualizarBadgesNtf(); }
}
function tocarNtf() { // beep curto sintetizado: sem depender de arquivo de áudio
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(820, t0); o.frequency.setValueAtTime(1080, t0 + 0.09);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.11, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.27);
  } catch {}
}
// chamado sempre que a lista de tickets do usuário chega (logado) — calcula quem tem mensagem nova não vista
function processarNtf(lista) {
  const vistos = lerVistos(), novos = new Set();
  lista.forEach((t) => {
    const ms_ = t.updatedAt?.toMillis?.() ?? 0, aberto = cur?.id === t.id && !$("#ticketsView").hidden;
    if (aberto) { marcarVisto(t.id, ms_); return; } // está vendo agora: já conta como visto
    if (ms_ > (vistos[t.id] || 0)) novos.add(t.id);
  });
  const soouNovo = !primeiraCargaNtf && [...novos].some((id) => !unreadIds.has(id));
  unreadIds = novos; primeiraCargaNtf = false;
  atualizarBadgesNtf();
  if (soouNovo) tocarNtf();
}
function atualizarBadgesNtf() {
  const tem = unreadIds.size > 0;
  $("#miTicketsDot").hidden = !tem; $("#accDot").hidden = !tem;
  renderList(); // redesenha os pontinhos nos itens da lista, se o painel estiver aberto
}
const PERMS = { // quem pode o quê (mude aqui se quiser)
  status:   ["dono", "vendedor"],   // marcar Pendente / Concluído
  reembolso: ["dono"],              // registrar reembolso
  equipe:   ["dono"],               // abrir o painel da equipe
};
const can = (acao) => !!papel && (PERMS[acao] || []).includes(papel);
const LABEL_PAPEL = { dono: "DONO", vendedor: "VENDEDOR", suporte: "SUPORTE" };
const tagEl = (cls, txt) => el("span", cls === "dono" ? "dono" : "rtag " + cls, txt);
const badgesPapel = () => [
  ...(papel === "dono" ? [tagEl("dono", "DONO")] : papel ? [tagEl("r-" + papel, LABEL_PAPEL[papel])] : []),
  ...(meComprador ? [tagEl("comprador", "COMPRADOR")] : []),
  ...(!papel && compChecado && !meComprador ? [tagEl("visitante", "FUTURO COMPRADOR")] : []), // quem ainda não comprou
];
const up = { file: null, task: null, busy: false, thumb: null }; // estado do anexo no chat

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
  if (e.key !== "Escape") return;
  const abertos = document.querySelectorAll(".mdl:not([hidden])");
  if (abertos.length) { abertos.forEach((m) => { if (!locked(m)) m.hidden = true; }); sync(); return; }
  if (!$("#ticketsView").hidden) { closeTickets(); return; } // painel de tickets/atendimento: Esc fecha e devolve o foco
  if (!$("#supportView").hidden) { Suporte.fechar(); return; } // central de suporte
});
const openLogin = () => { $("#loginErr").textContent = ""; open("#loginModal"); };

/* ---------- acessibilidade: navegação só por teclado no painel de tickets e nos menus ---------- */
// elementos realmente visíveis e focáveis dentro de um container
const focaveis = (c) => Array.from(c.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((e) => e.offsetParent !== null);
// prende o Tab dentro do container enquanto `ativo()` for verdadeiro (não deixa o foco "vazar" para o site por trás)
function prenderFoco(container, ativo) {
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !ativo()) return;
    const f = focaveis(container); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
// setas/Home/End para navegar entre os itens de um menu (role="menuitem"); Tab fecha o menu
function navMenuTeclado(menuEl, fechar) {
  menuEl.addEventListener("keydown", (e) => {
    const its = Array.from(menuEl.querySelectorAll('[role="menuitem"]:not([hidden])')); if (!its.length) return;
    const i = its.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); its[(i + 1 + its.length) % its.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); its[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); its[its.length - 1].focus(); }
    else if (e.key === "Tab") fechar();
  });
}
let focoAntesPainel = null; // elemento focado antes de abrir o painel de tickets, para devolver o foco ao fechar
prenderFoco($("#ticketsView"), () => !$("#ticketsView").hidden && !document.querySelector(".mdl:not([hidden])"));

/* ---------- AUTH WALL ---------- */
const root = document.documentElement; // as classes .gate/.loading vivem no <html> (ver css/auth-gate.css)

// Bloqueia o site: limpa qualquer estado da sessão anterior e deixa só o login visível.
function lockSite(msg = "") {
  unsubT?.(); unsubM?.(); unsubT = unsubM = null; unsubAud?.(); unsubAud = null; auditoria = [];
  resetUpload(); Suporte.reset();
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
const wallTimer = setTimeout(() => { if (root.classList.contains("loading")) lockSite("Conexão lenta. Tente entrar novamente."); }, 8000);

/* ---------- login ---------- */
const erro = (c) => ({
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Este e-mail já tem conta. Use Entrar.",
  "auth/weak-password": "Senha muito curta (mínimo 6).",
  "auth/invalid-email": "E-mail inválido.",
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/popup-blocked": "O navegador bloqueou a janela de login. Libere pop-ups para este site.",
  "auth/unauthorized-domain": "Este domínio não está autorizado no Firebase (Authorized domains).",
  "auth/operation-not-allowed": "Este método de login não está ativado no Firebase.",
  "auth/account-exists-with-different-credential": "Já existe uma conta com este e-mail usando outro método de login.",
}[c] ?? "Não foi possível entrar. Tente de novo.");
const falha = (e) => { console.error(e); $("#loginErr").textContent = erro(e.code); };

// Discord entra como provedor OpenID Connect do Firebase (Authentication > Sign-in method > OpenID Connect)
const DISCORD_PROVIDER_ID = "oidc.discord"; // TEM que ser igual ao Provider ID mostrado no Firebase Console
const entrarPopup = (provider) => signInWithPopup(auth, provider).catch(falha);

$("#gBtn").onclick = () => entrarPopup(new GoogleAuthProvider());
$("#dBtn").onclick = () => {
  const provider = new OAuthProvider(DISCORD_PROVIDER_ID);
  provider.addScope("identify");
  entrarPopup(provider);
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
/* ---------- Discord obrigatório: conectar/desconectar a conta (login por OAuth — nunca pelo token da conta) ---------- */
function discordConectado() { return provIds().includes(DISCORD_PROVIDER_ID); } // provIds() é definida mais abaixo (function = hoisted)
function googleConectado() { return provIds().includes("google.com"); }
let dcPendingBuy = null; // produto que a pessoa tentou comprar antes de conectar: a compra continua sozinha assim que ela conecta
const erroVinculo = (nome, c) => ({
  "auth/credential-already-in-use": `Essa conta do ${nome} já está vinculada a outro login deste site. Entre com ela diretamente pela tela de login, ou fale com o suporte.`,
  "auth/provider-already-linked": `Sua conta já está conectada ao ${nome}.`,
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/popup-blocked": "O navegador bloqueou a janela de login. Libere pop-ups para este site.",
  "auth/requires-recent-login": "Por segurança, saia, entre de novo e tente conectar em seguida.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
}[c] ?? "Não foi possível conectar. Tente de novo.");
async function linkDiscordCore() { // adiciona o Discord à conta atual (OAuth com escopo "identify" — sem senha, sem token)
  const provider = new OAuthProvider(DISCORD_PROVIDER_ID); provider.addScope("identify");
  await linkWithPopup(user, provider);
  await user.reload().catch(() => {}); user = auth.currentUser; renderNav();
}
async function linkGoogleCore() { // adiciona o Google à conta atual
  await linkWithPopup(user, new GoogleAuthProvider());
  await user.reload().catch(() => {}); user = auth.currentUser; renderNav();
}
function abrirDcModal(motivo) {
  $("#dcErr").textContent = ""; $("#dcGo").disabled = false; $("#dcGo").textContent = "Conectar Discord";
  $("#dcSub").textContent = motivo || "Conecte sua conta do Discord para comprar e receber os cargos automáticos do servidor.";
  open("#dcModal");
}
$("#dcReqBtn").onclick = () => abrirDcModal();
$("#dcGo").onclick = async () => {
  const b = $("#dcGo"); b.disabled = true; b.textContent = "Conectando...";
  try {
    await linkDiscordCore(); close("#dcModal");
    if (dcPendingBuy) { const k = dcPendingBuy; dcPendingBuy = null; askBuy(k); } // retoma a compra que ficou pendente
  } catch (e) { console.error(e); $("#dcErr").textContent = erroVinculo("Discord", e.code); b.disabled = false; b.textContent = "Conectar Discord"; }
};

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
  if (show) { document.querySelector("nav").classList.remove("open"); closePnl(); menu.querySelector('[role="menuitem"]')?.focus(); } // fecha o menu hambúrguer + o dropdown "Painel" + leva o foco pro 1º item
};
function renderNav() {
  const src = avatarOf(user);
  setImg($("#accImg"), src); setImg($("#accMenuImg"), src);
  $("#accName").textContent = user ? user.displayName || (user.email || "Cliente").split("@")[0] : "";
  $("#accNick").textContent = user ? (user.displayName || (user.email || "Cliente").split("@")[0]).split(" ")[0] : "";
  $("#accMail").textContent = user?.email || (user && provIds().includes(DISCORD_PROVIDER_ID) ? "Conta Discord" : "");
  $("#dcReqBtn").hidden = !user || discordConectado();
  $("#panelBtn").hidden = !isStaff; $("#teamNavBtn").hidden = !can("equipe"); $("#consoleNavBtn").hidden = !isAdmin;
  $("#pnlGrp").hidden = !isStaff && !can("equipe");

  $("#accTags").replaceChildren(...(papel && papel !== "dono" ? [tagEl("r-" + papel, LABEL_PAPEL[papel])] : []), ...(meComprador ? [tagEl("comprador", "COMPRADOR")] : []), ...(user && !papel && compChecado && !meComprador ? [tagEl("visitante", "FUTURO COMPRADOR")] : []));
  document.querySelectorAll(".acc-own").forEach((n) => { n.style.display = isAdmin ? "" : "none"; }); // coroa + DONO só para o dono
  if (!user) closeMenu();
  Suporte.sync({ user, papel });
}
$("#accBtn").onclick = (e) => { e.stopPropagation(); if (user) toggleMenu(); };
$("#accBtn").addEventListener("keydown", (e) => { // seta para baixo/cima no avatar já abre o menu com o foco dentro
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && user) { e.preventDefault(); if (menu.hidden) toggleMenu(); else menu.querySelector('[role="menuitem"]')?.focus(); }
});
navMenuTeclado(menu, closeMenu);
document.addEventListener("click", (e) => { if (!e.target.closest("#acc")) closeMenu(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { closeMenu(); $("#accBtn").focus(); } });
$("#mb")?.addEventListener("click", closeMenu);
$("#miProfile").onclick = () => { closeMenu(); openProfile(); };
$("#miTickets").onclick = () => { closeMenu(); openTickets(false); };
$("#miSupport").onclick = () => { closeMenu(); Suporte.abrir(); };
// Central de Suporte: "Ver pedido" abre o ticket de compra correspondente
Suporte.init({ abrirPedido: (id, admin) => { Suporte.fechar(); openTickets(admin && isStaff, id); } });
/* ---------- botão único "Painel" (dropdown com as opções da equipe) ---------- */
const pnlMenu = $("#pnlMenu");
const closePnl = () => { pnlMenu.hidden = true; $("#pnlBtn").setAttribute("aria-expanded", "false"); };
$("#pnlBtn").onclick = (e) => {
  e.stopPropagation();
  if (can("equipe")) { const show = pnlMenu.hidden; pnlMenu.hidden = !show; $("#pnlBtn").setAttribute("aria-expanded", String(show)); closeMenu(); if (show) pnlMenu.querySelector('[role="menuitem"]:not([hidden])')?.focus(); }
  else { openTickets(true); } // só vendedor/suporte: um clique já abre o painel
};
$("#pnlBtn").addEventListener("keydown", (e) => {
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && can("equipe")) { e.preventDefault(); if (pnlMenu.hidden) $("#pnlBtn").click(); else pnlMenu.querySelector('[role="menuitem"]:not([hidden])')?.focus(); }
});
navMenuTeclado(pnlMenu, closePnl);
document.addEventListener("click", (e) => { if (!e.target.closest("#pnlGrp")) closePnl(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !pnlMenu.hidden) { closePnl(); $("#pnlBtn").focus(); } });
$("#panelBtn").onclick = () => { closePnl(); openTickets(true); };
$("#teamNavBtn").onclick = () => { closePnl(); abrirEquipe(); };
$("#consoleNavBtn").onclick = () => { closePnl(); abrirConsole(); };
$("#miOut").onclick = () => { closeMenu(); signOut(auth); }; // o onAuthStateChanged abaixo devolve para a tela de login
renderNav();

// ÚNICA fonte de verdade da tela: o site só é liberado aqui, quando o Firebase confirma o usuário.
onAuthStateChanged(auth, (u) => {
  clearTimeout(wallTimer);
  user = u; isAdmin = !!u && u.email === ADMIN_EMAIL && u.emailVerified; // só a interface; as regras do Firebase é que protegem
  unsubPapel?.(); unsubEq?.(); unsubComp?.(); unsubPapel = unsubEq = unsubComp = null; meComprador = false; compChecado = false;
  papel = isAdmin ? "dono" : null; isStaff = !!papel;
  if (u) {
    // ao vivo: assim que um ticket seu for marcado como Concluído, "FUTURO COMPRADOR" vira "COMPRADOR" sem recarregar
    unsubComp = ouvirTickets(u, false, (l) => {
      if (user !== u) return;
      const v = l.some((t) => t.status === "concluido");
      if (v !== meComprador || !compChecado) {
        meComprador = v; compChecado = true; renderNav();
        if (cur && msgsCache.length && !$("#ticketsView").hidden) renderMsgs(msgsCache);
      }
      if (!adminMode) processarNtf(l); // "Meus Tickets": badge + som quando chega resposta nova
    });
    if (!isAdmin) unsubPapel = ouvirMeuPapel(u, (p) => { // vendedor/suporte: vale na hora, e some na hora se você remover
      papel = p; isStaff = !!p; renderNav();
      if (!isStaff && adminMode) closeTickets(); else if (cur) head();
    });
  }
  renderNav();
  if (u) unlockSite();
  else { lockSite(); unreadIds = new Set(); primeiraCargaNtf = true; $("#miTicketsDot").hidden = $("#accDot").hidden = true; } // sem sessão: limpa os avisos
});

/* ---------- comprar -> modal de confirmação -> ticket ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("[data-buy]"); const k = a?.dataset.buy;
  if (!a || !PRODUTOS[k]) return; e.preventDefault();
  if (user) askBuy(k); // sem sessão o site nem está visível; a checagem é só por segurança
});
function askBuy(k) {
  if (!discordConectado()) { dcPendingBuy = k; abrirDcModal("Para comprar, conecte sua conta do Discord. É rápido, e você já pode usar esse mesmo login depois."); return; }
  buyKey = k; $("#buyName").textContent = PRODUTOS[k].nome; $("#buyPrice").textContent = `R$ ${PRODUTOS[k].preco},00`; open("#buyModal");
}
$("#buyOk").onclick = async () => {
  const b = $("#buyOk"); b.disabled = true;
  try { const id = await criarTicket(user, buyKey); close("#buyModal"); openTickets(false, id); }
  catch (e) { alert("Não foi possível criar o ticket: " + e.message); }
  b.disabled = false;
};

/* ---------- Meus Tickets / Painel Admin ---------- */
// assinatura do que muda a aparência do chat: nome/foto de quem fala + quem já é COMPRADOR (redesenha quando algo disso muda)
const sigAtual = () => cur ? [cur.userName, cur.userPhoto, cur.adminName, cur.adminPhoto,
  adminMode ? [...new Set(tickets.filter((x) => x.status === "concluido").map((x) => x.uid))].sort().join(",") : meComprador].join("|") : "";
const ms = (t) => t?.toMillis?.() ?? Date.now();
const fmt = (t) => (t?.toDate ? t.toDate().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
function openTickets(admin, select) {
  focoAntesPainel = document.activeElement; // para devolver o foco quando fechar (Esc ou "Voltar ao site")
  adminMode = admin; cur = null; $("#tvTitle").textContent = admin ? (isAdmin ? "Painel Ticket Admin" : "Painel de Atendimento") : "Meus Tickets";
  busca = ""; filtro = "todos"; $("#tvSearch").value = ""; $("#tvTools").hidden = !admin; // busca só no painel do dono
  $("#tvMe").textContent = user.displayName || user.email || ""; $("#ticketsView").classList.remove("open"); resetChat(); open("#ticketsView");
  $("#tvBack").focus(); // primeiro elemento focável do painel: quem navega só por teclado já entra com o foco lá dentro
  unsubT?.(); unsubT = ouvirTickets(user, admin, (l) => {
    tickets = l.sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt));
    if (!adminMode) { const v = tickets.some((t) => t.status === "concluido"); if (v !== meComprador || !compChecado) { meComprador = v; compChecado = true; renderNav(); } }
    if (select) { const t = tickets.find((x) => x.id === select); if (t) { select = null; return pick(t); } }
    if (cur) cur = tickets.find((x) => x.id === cur.id) || cur; head(); renderList();
    if (!adminMode) processarNtf(tickets); // atualiza os pontinhos ao vivo com o painel aberto
    const sig = sigAtual();
    if (sig !== sigPerfis) { sigPerfis = sig; if (cur && msgsCache.length) renderMsgs(msgsCache); }
  });
}
// "Voltar ao site": fecha só o painel de tickets (o usuário continua logado)
function closeTickets() { unsubT?.(); unsubM?.(); unsubT = unsubM = null; resetUpload(); cur = null; $("#ticketsView").hidden = true; sync(); focoAntesPainel?.focus(); focoAntesPainel = null; }
$("#tvBack").onclick = closeTickets;
$("#chBack").onclick = () => $("#ticketsView").classList.remove("open");
/* ---------- busca e filtro (painel admin) ---------- */
const norm = (x) => String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const termos = () => norm(busca).split(/\s+/).filter(Boolean);
const alvoBusca = (t) => norm([t.userName, t.userEmail, t.productName, STATUS_LABEL[t.status], t.id, "#" + t.id.slice(0, 6)].join(" "));
const bate = (t, ts) => ts.every((x) => alvoBusca(t).includes(x));
// escreve o texto destacando os termos buscados (sem innerHTML: seguro contra XSS)
function marca(parent, texto) {
  const ts = termos(); texto = String(texto ?? "");
  if (!ts.length) { parent.append(texto); return parent; }
  const n = norm(texto); // normalização mantém o mesmo tamanho na maioria dos casos
  if (n.length !== texto.length) { parent.append(texto); return parent; }
  const marcado = new Array(texto.length).fill(false);
  ts.forEach((x) => { for (let i = n.indexOf(x); i !== -1; i = n.indexOf(x, i + x.length)) for (let k = i; k < i + x.length; k++) marcado[k] = true; });
  let i = 0;
  while (i < texto.length) {
    let j = i; while (j < texto.length && marcado[j] === marcado[i]) j++;
    const pedaco = texto.slice(i, j);
    if (marcado[i]) parent.append(el("mark", "", pedaco)); else parent.append(pedaco);
    i = j;
  }
  return parent;
}
function avatarTicket(t) {
  const av = el("div", "tk-av");
  const foto = adminMode ? t.userPhoto : "";
  if (foto && /^https:\/\//.test(foto)) { const i = el("img"); i.alt = ""; i.loading = "lazy"; setImg(i, foto); av.append(i); }
  else if (adminMode) av.textContent = (t.userName || "?")[0].toUpperCase();
  else av.innerHTML = '<svg class="ic"><use href="#i-ticket"/></svg>';
  return av;
}
function atualizarFiltros(base) {
  const c = { todos: base.length, pendente: 0, concluido: 0, reembolsado: 0 };
  base.forEach((t) => { if (c[t.status] != null) c[t.status]++; });
  document.querySelectorAll("#tvFilters .fchip").forEach((b) => {
    b.classList.toggle("on", b.dataset.f === filtro); b.querySelector("b").textContent = c[b.dataset.f] ?? 0;
  });
  $("#tvSearchX").hidden = !busca;
}
function renderList() {
  const box = $("#tvList"); box.replaceChildren();
  const ts = adminMode ? termos() : [];
  const comp = adminMode ? new Set(tickets.filter((x) => x.status === "concluido").map((x) => x.uid)) : null; // quem já comprou
  const porBusca = adminMode ? tickets.filter((t) => bate(t, ts)) : tickets;
  if (adminMode) atualizarFiltros(porBusca);
  const lista = adminMode && filtro !== "todos" ? porBusca.filter((t) => t.status === filtro) : porBusca;
  if (!tickets.length) box.append(el("p", "empty", adminMode ? "Nenhum ticket ainda." : "Você ainda não tem tickets. Clique em Comprar em um plano."));
  else if (!lista.length) box.append(el("p", "empty", busca ? `Nada encontrado para “${busca.trim()}”.` : "Nenhum ticket neste filtro."));
  lista.forEach((t) => {
    const b = el("button", "tk-i" + (cur?.id === t.id ? " on" : "")); b.type = "button";
    const col = el("div", "tk-b"), l1 = el("div", "tk-l1"), nm = el("div", "tk-n");
    nm.append(marca(el("span", "tk-t"), adminMode ? t.userName || "Cliente" : t.productName));
    if (comp?.has(t.uid)) nm.append(tagEl("comprador", "COMPRADOR")); // tag ao lado do nome
    else if (adminMode) nm.append(tagEl("visitante", "FUTURO COMPRADOR"));
    l1.append(nm);
    col.append(l1);
    if (adminMode) {
      col.append(marca(el("span", "tk-s"), t.productName + (t.price != null ? " · R$ " + t.price + ",00" : "")));
      if (t.userEmail) col.append(marca(el("span", "tk-d"), t.userEmail));
    }
    const ft = el("div", "tk-f"); ft.append(el("span", "tk-id", "#" + t.id.slice(0, 6).toUpperCase()), el("span", "tk-dt", fmt(t.updatedAt)));
    col.append(ft);
    b.append(avatarTicket(t), col, el("span", "tk-stt stt " + t.status, STATUS_LABEL[t.status] ?? t.status));
    if (!adminMode && unreadIds.has(t.id)) b.append(el("span", "tk-dot"));
    b.onclick = () => pick(t); box.append(b);
  });
}
$("#tvSearch").addEventListener("input", (e) => { busca = e.target.value; renderList(); });
$("#tvSearch").addEventListener("keydown", (e) => { if (e.key === "Escape" && busca) { e.stopPropagation(); limparBusca(); } });
function limparBusca() { busca = ""; $("#tvSearch").value = ""; renderList(); $("#tvSearch").focus(); }
$("#tvSearchX").onclick = limparBusca;
$("#chCopyId").onclick = async () => { // copia o ID completo do ticket (útil para localizar o pedido no suporte)
  if (!cur) return;
  try { await navigator.clipboard.writeText(cur.id); } catch { return; }
  const b = $("#chCopyId"); b.classList.add("ok");
  setTimeout(() => b.classList.remove("ok"), 1500);
};
document.querySelectorAll("#tvFilters .fchip").forEach((b) => (b.onclick = () => { filtro = b.dataset.f; renderList(); }));

function head() {
  $("#chTitle").textContent = cur ? cur.productName : "Selecione um ticket";
  $("#chSub").textContent = cur ? (adminMode ? [cur.userName, cur.userEmail, "R$ " + (cur.price ?? "") + ",00"].filter(Boolean).join(" · ") : "Ticket #" + cur.id.slice(0, 6).toUpperCase()) : "";
  const cp = $("#chCopyId"); cp.hidden = !cur; cp.classList.remove("ok");
  if (cur) cp.title = "Copiar ID do ticket (#" + cur.id.slice(0, 6).toUpperCase() + ")";
  const s = $("#chStatus");
  s.textContent = cur ? (STATUS_LABEL[cur.status] ?? cur.status) : "";
  s.className = "stt " + (cur?.status || "");
  $("#stPend").classList.toggle("on", cur?.status === "pendente");
  $("#stDone").classList.toggle("on", cur?.status === "concluido");
  const rf = $("#stRefund"), reemb = cur?.status === "reembolsado";
  rf.classList.toggle("on", reemb); rf.disabled = reemb; rf.textContent = reemb ? "Reembolsado" : "Reembolsar";
  $("#stPend").hidden = $("#stDone").hidden = !can("status"); $("#stRefund").hidden = !can("reembolso");
  $("#stPend").disabled = $("#stDone").disabled = cur?.status === "reembolsado" && !isAdmin; // só o dono desfaz reembolso
  $("#admTools").hidden = !(adminMode && isStaff && cur && (can("status") || can("reembolso"))); $("#chatForm").hidden = !cur;
  $("#chatBox").classList.toggle("vazio", !cur);
}
function resetChat() { resetUpload(); $("#chatBox").replaceChildren(); head(); }
function pick(t) {
  if (cur?.id !== t.id) resetUpload(); // trocou de ticket: cancela/limpa o anexo pendente
  cur = t; msgsCache = []; head(); renderList(); $("#ticketsView").classList.add("open"); unsubM?.();
  unsubM = ouvirMensagens(t.id, renderMsgs);
  if (!adminMode) marcarVisto(t.id, t.updatedAt?.toMillis?.());
}
// transforma http(s)://... e www.... em links clicáveis (só http/https: nunca javascript:)
function linkify(p, text) {
  text.split(/((?:https?:\/\/|www\.)[^\s<]+)/g).forEach((s, i) => {
    if (!(i % 2)) { p.append(s); return; }
    const fim = s.match(/[.,;:!?)\]]+$/)?.[0] ?? "", url = fim ? s.slice(0, -fim.length) : s;
    const a = el("a", "", url); a.href = /^www\./i.test(url) ? "https://" + url : url;
    a.target = "_blank"; a.rel = "noopener noreferrer"; p.append(a, fim);
  });
}

/* ---------- chat (design v3) ---------- */
const horaDe = (t) => t?.toDate ? t.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "enviando…";
function rotuloDia(d) {
  const hoje = new Date(), ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
const crownIcon = () => {
  const s = el("span", "crown");
  s.innerHTML = '<svg viewBox="0 0 100 80"><use href="#cr"/></svg>'; // símbolo #cr já existe no index.html
  return s;
};

// nome/foto ATUAIS de quem escreveu (a mensagem só guarda uma cópia antiga)
function perfilDe(m) {
  if (user && m.uid === user.uid) return { name: user.displayName || m.name, photo: user.photoURL || "" };
  if (m.isAdmin && (!m.role || m.role === "dono")) return { name: cur?.adminName || m.name, photo: cur?.adminPhoto || m.photo };
  if (cur && m.uid === cur.uid) return { name: cur.userName || m.name, photo: cur.userPhoto || m.photo };
  return { name: m.name, photo: m.photo };
}
// cartão bonito para a mensagem automática de reembolso (só textContent: seguro contra XSS)
function cartaoReembolso(valor, razao) {
  const c = el("div", "rfc"), h = el("div", "rfc-h"), ic = el("span", "rfc-ic"), tx = el("div", "rfc-t");
  ic.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>'; // SVG fixo
  tx.append(el("small", "", "REEMBOLSO CONFIRMADO"), el("span", "", "Valor devolvido a você"));
  h.append(ic, tx); c.append(h, el("div", "rfc-v", valor));
  const [motivo, ...resto] = String(razao || "").split(" — "), obs = resto.join(" — ");
  if (motivo || obs) c.append(el("div", "rfc-sep"));
  [["Motivo", motivo], ["Observação", obs]].forEach(([k, v]) => {
    if (!v) return; const r = el("div", "rfc-r"); r.append(el("span", "", k), el("b", "", v)); c.append(r);
  });
  return c;
}
function renderMsgs(list) {
  msgsCache = list; sigPerfis = sigAtual();
  const box = $("#chatBox"); box.replaceChildren(); box.classList.remove("vazio");
  let ultimoDia = null;
  const comp = adminMode ? new Set(tickets.filter((x) => x.status === "concluido").map((x) => x.uid)) : null;
  list.forEach((m) => {
    const d = m.createdAt?.toDate?.() ?? new Date();
    if (d.toDateString() !== ultimoDia) { ultimoDia = d.toDateString(); box.append(el("div", "dsep", rotuloDia(d))); }

    const mine = !!user && m.uid === user.uid;
    const rol = m.isAdmin ? (m.role === "vendedor" || m.role === "suporte" ? m.role : "dono") : null; // cargo de quem escreveu
    const row = el("div", "msg " + (m.isAdmin ? "adm" : "cli") + (rol && rol !== "dono" ? " r-" + rol : "") + (mine ? " mine" : ""));

    const pf = perfilDe(m), av = el("div", "mav");
    if (pf.photo && /^https:\/\//.test(pf.photo)) { const i = el("img"); i.src = pf.photo; i.alt = ""; i.referrerPolicy = "no-referrer"; av.append(i); }
    else av.textContent = (pf.name || "?")[0].toUpperCase();

    const col = el("div", "mcol"), nome = el("div", "mname");
    if (rol === "dono") nome.append(crownIcon());
    nome.append(el("span", "", pf.name || "?"));
    if (rol === "dono") nome.append(el("span", "dono", "DONO"));
    else if (rol) nome.append(tagEl("r-" + rol, LABEL_PAPEL[rol]));
    else if (adminMode ? comp.has(m.uid) : (meComprador && user && m.uid === user.uid)) nome.append(tagEl("comprador", "COMPRADOR"));
    else if (adminMode || (compChecado && user && m.uid === user.uid)) nome.append(tagEl("visitante", "FUTURO COMPRADOR")); // cliente que ainda não comprou

    const bub = el("div", "bub");
    const rfm = m.isAdmin && m.text ? /^↺ Reembolso registrado: (R\$ [\d.,]+)\.(?: Motivo: ([\s\S]*)\.)?$/.exec(m.text.trim()) : null;
    if (rfm) { bub.classList.add("rfm"); bub.append(cartaoReembolso(rfm[1], rfm[2])); }
    else if (m.text) { const p = el("div", "mt"); linkify(p, m.text); bub.append(p); }
    if (m.fileUrl && /^https:\/\//.test(m.fileUrl)) {
      if ((m.fileType || "").startsWith("image/")) {
        const a = el("a"); a.href = m.fileUrl; a.target = "_blank"; a.rel = "noopener";
        const i = el("img", "mimg"); i.src = m.fileUrl; i.alt = m.fileName || ""; i.loading = "lazy"; i.onload = () => { box.scrollTop = box.scrollHeight; }; a.append(i); bub.append(a);
      } else {
        // botão de download bem visível: ícone, nome, tamanho e o selo BAIXAR
        const a = el("a", "mfile"); a.href = m.fileUrl; a.rel = "noopener"; a.setAttribute("download", m.fileName || "arquivo");
        a.title = "Clique para baixar " + (m.fileName || "o arquivo");
        const ico = el("span", "mf-ico"); // SVG fixo (sem dados do usuário)
        ico.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>';
        const info = el("span", "mf-info");
        info.append(el("span", "mf-name", m.fileName || "arquivo"),
          el("small", "mf-sub", "Clique para baixar" + (m.fileSize ? " · " + fmtBytes(m.fileSize) : "")));
        a.append(ico, info, el("span", "mf-cta", "BAIXAR"));
        bub.append(a);
      }
    }
    const t = el("time", "mtime", horaDe(m.createdAt)); t.title = d.toLocaleString("pt-BR"); bub.append(t);

    col.append(nome, bub); row.append(av, col); box.append(row);
  });
  box.scrollTop = box.scrollHeight;
}

/* ---------- anexos: seleção, progresso e envio (Fase 4) ---------- */
// Tolerante: se o bloco novo do <form id="chatForm"> ainda não foi colado no index.html,
// o resto do site (perfil, tickets, status...) continua funcionando; só os anexos ficam desativados.
const uplOk = () => ["#upl", "#uplX", "#uplFill", "#uplMeta", "#uplName", "#uplThumb", "#uplIc", "#uplErr"].every((s) => $(s));
if (!uplOk()) console.error('[Nx7] Formulário do chat desatualizado: cole o novo bloco <form id="chatForm"> no index.html (Fase 4). Anexos desativados.');
$("#chFile").accept = ARQUIVOS_ACEITOS;

function uplEstado(cls, meta) {
  if (!uplOk()) return;
  $("#upl").className = "upl" + (cls ? " " + cls : ""); // "", "sending", "done" ou "err" (a barra só aparece nos 3 últimos)
  if (meta != null) $("#uplMeta").textContent = meta;
}
function uplBarra(frac) { const b = $("#uplFill"); if (b) b.style.width = Math.round(frac * 100) + "%"; }
function uplErr(msg) { const p = $("#uplErr"); if (p) p.textContent = msg; else if (msg) alert(msg); }
function setOcupado(on) {
  $("#chatForm")?.classList.toggle("busy", on);
  ["#chSend", "#chText", "#chFile"].forEach((s) => { const x = $(s); if (x) x.disabled = on; });
  const b = $("#chSend"); if (b) b.textContent = on ? "Enviando…" : "Enviar";
}
// limpa o anexo; se um upload estiver rodando, ele é cancelado
function resetUpload() {
  try { up.task?.cancel(); } catch {}
  up.task = null; up.file = null; up.busy = false;
  if (up.thumb) { URL.revokeObjectURL(up.thumb); up.thumb = null; }
  const f = $("#chFile"); if (f) f.value = "";
  if (uplOk()) { $("#upl").hidden = true; $("#uplThumb").hidden = true; $("#uplIc").hidden = false; uplBarra(0); uplEstado("", ""); }
  uplErr(""); setOcupado(false);
}
$("#uplX")?.addEventListener("click", resetUpload); // "×": remove o anexo ou cancela o envio em andamento

$("#chFile").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (!uplOk()) { e.target.value = ""; alert("Para enviar arquivos, cole o novo formulário do chat no index.html (Fase 4)."); return; }
  const problema = validarArquivo(f);
  if (problema) { resetUpload(); uplErr(problema); return; }
  if (up.thumb) { URL.revokeObjectURL(up.thumb); up.thumb = null; }
  up.file = f; uplErr("");
  const img = f.type.startsWith("image/");
  if (img) { up.thumb = URL.createObjectURL(f); $("#uplThumb").src = up.thumb; }
  $("#uplThumb").hidden = !img; $("#uplIc").hidden = img;
  $("#uplName").textContent = f.name; uplBarra(0);
  uplEstado("", fmtBytes(f.size) + " · pronto para enviar"); $("#upl").hidden = false;
};

$("#chatForm").onsubmit = async (e) => {
  e.preventDefault();
  if (up.busy) return;
  const f = uplOk() ? up.file : null, text = $("#chText").value.trim();
  if (!cur || (!text && !f)) return;
  up.busy = true; setOcupado(true); uplErr("");
  if (f) { uplBarra(0); uplEstado("sending", "Enviando… 0%"); }
  try {
    await enviarMensagem(cur.id, user, {
      text, file: f, role: papel,
      onTask: (task) => (up.task = task),
      onProgress: ({ pct, sent, total }) => {
        uplBarra(pct);
        uplEstado("sending", `Enviando… ${Math.round(pct * 100)}% · ${fmtBytes(sent)} de ${fmtBytes(total)}`);
      },
    }, adminMode && isStaff);
    if (f) { uplBarra(1); uplEstado("done", "Enviado ✓"); await new Promise((r) => setTimeout(r, 800)); }
    $("#chText").value = ""; resetUpload();
  } catch (err) {
    if (err.code === "storage/canceled") return; // o usuário apertou "×": o resetUpload já limpou a tela
    console.error(err);
    uplErr(err.message || "Não foi possível enviar.");
    if (f) uplEstado("err", "Falhou. Clique em Enviar para tentar de novo.");
  } finally {
    up.busy = false; up.task = null; setOcupado(false);
  }
};

/* ---------- status do ticket (admin) ---------- */
async function mudarStatus(novo) {
  if (!cur || !can("status") || cur.status === novo) return;
  const btns = [$("#stPend"), $("#stDone")], id = cur.id, antigo = cur.status;
  const aplicar = (st) => {
    const limpa = st !== "reembolsado" ? { refundedAt: null, refundReason: null, refundAmount: null } : {};
    tickets = tickets.map((t) => (t.id === id ? { ...t, status: st, ...limpa } : t));
    if (cur?.id === id) cur = { ...cur, status: st, ...limpa };
    head(); renderList();
  };
  btns.forEach((b) => (b.disabled = true));
  aplicar(novo);                                   // reflete na tela na hora
  try {
    await definirStatus(id, novo, antigo === "reembolsado");
    // cargo COMPRADOR no Discord: dá ao concluir; tira se saiu de "concluído" (e não tem outra compra)
    if (novo === "concluido") {
      avisarVendaConcluida(id); // webhook: "fulano comprou X"
      registrarAuditoria("venda", "concluida", { alvo: id, detalhe: `${cur?.productName || ""} — ${brl(cur?.price)}` }, user, papel);
    }
    if (novo === "concluido" || antigo === "concluido") sincronizarDiscord(user, { action: "buyer", ticketId: id, grant: novo === "concluido" });
  }
  catch (e) { aplicar(antigo); alert(e.message); } // o banco recusou: desfaz
  btns.forEach((b) => (b.disabled = false));
}
$("#stPend").onclick = () => mudarStatus("pendente");
$("#stDone").onclick = () => mudarStatus("concluido");

/* ---------- reembolso (admin) ---------- */
$("#stRefund").onclick = () => {
  if (!cur || !isAdmin || cur.status === "reembolsado") return;
  $("#rfProd").textContent = cur.productName; $("#rfVal").textContent = brl(cur.price);
  $("#rfWho").textContent = [cur.userName, cur.userEmail].filter(Boolean).join(" · ");
  $("#rfMot").selectedIndex = 0; $("#rfObs").value = ""; $("#rfPago").checked = false; rfLimpaArquivo();
  $("#rfOk").disabled = true; $("#rfErr").textContent = "";
  open("#refundModal");
};
$("#rfFile").accept = ARQUIVOS_ACEITOS;
function rfLimpaArquivo() { $("#rfFile").value = ""; $("#rfFileN").textContent = ""; $("#rfFileX").hidden = true; }
$("#rfFile").onchange = () => {
  const f = $("#rfFile").files[0]; if (!f) return rfLimpaArquivo();
  const erro = validarArquivo(f);
  if (erro) { rfLimpaArquivo(); $("#rfErr").textContent = erro; return; }
  $("#rfErr").textContent = ""; $("#rfFileN").textContent = f.name + " · " + fmtBytes(f.size); $("#rfFileX").hidden = false;
};
$("#rfFileX").onclick = rfLimpaArquivo;
$("#rfPago").onchange = (e) => ($("#rfOk").disabled = !e.target.checked); // só libera depois de marcar que o dinheiro já voltou
$("#rfOk").onclick = async () => {
  if (!cur || !isAdmin || cur.status === "reembolsado") return;
  const id = cur.id, valor = cur.price ?? 0, motivo = $("#rfMot").value, obs = $("#rfObs").value.trim(), btn = $("#rfOk");
  btn.disabled = true; btn.textContent = "Registrando…"; $("#rfErr").textContent = "";
  try {
    const r = await reembolsarTicket(id, user, { motivo, obs, valor, file: $("#rfFile").files[0] || null,
      onProgress: (p) => { if (p?.pct != null) btn.textContent = "Enviando comprovante… " + Math.round(p.pct * 100) + "%"; } });
    if (r?.aviso) alert(r.aviso);
    const extra = { status: "reembolsado", refundAmount: valor, refundReason: [motivo, obs].filter(Boolean).join(" — ") };
    tickets = tickets.map((t) => (t.id === id ? { ...t, ...extra } : t));
    if (cur?.id === id) cur = { ...cur, ...extra };
    close("#refundModal"); head(); renderList();
    sincronizarDiscord(user, { action: "buyer", ticketId: id, grant: false }); // reembolsou: tira o cargo COMPRADOR (se não tiver outra compra)
  } catch (e) {
    $("#rfErr").textContent = e.message || "Não foi possível registrar o reembolso.";
    btn.disabled = !$("#rfPago").checked;
  }
  btn.textContent = "Confirmar reembolso";
};

/* ---------- equipe (só o dono) ---------- */
const msgEq = (e) => e?.message || "Não deu certo. Tente de novo.";
// frase curta sobre o que aconteceu com o cargo no Discord (vazio se o Discord não está configurado / não se aplica)
const notaDiscord = (r) => !r || r.skipped ? ""
  : r.ok ? " Cargo do Discord atualizado."
  : r.reason === "not_in_guild" ? " (Cargo do Discord não aplicado: a pessoa não está no seu servidor.)"
  : r.reason === "bot_sem_permissao" ? " (Cargo do Discord não aplicado: coloque o cargo do bot acima dos outros cargos.)"
  : " (Não consegui atualizar o cargo no Discord.)";
function equipeErro(t) { $("#tmOk").textContent = ""; $("#tmErr").textContent = t || ""; }
function equipeOk(t) { $("#tmErr").textContent = ""; $("#tmOk").textContent = t || ""; }
function dicaEquipe() {
  const d = $("#tmTipo").value === "discord";
  $("#tmVal").placeholder = d ? "ID do Discord (só números)" : "email@gmail.com";
  $("#tmVal").inputMode = d ? "numeric" : "email";
  $("#tmHint").textContent = d
    ? "No Discord: Configurações > Avançado > ligue o Modo desenvolvedor. Depois clique com o botão direito no perfil da pessoa > Copiar ID do usuário."
    : "Use o e-mail da conta Google dela (ou o e-mail do cadastro, já confirmado). É com essa conta que ela vai entrar no site.";
}
function renderEquipe() {
  const box = $("#tmList"); box.replaceChildren();
  if (!equipe.length) return box.append(el("p", "empty", "Ninguém na equipe ainda. Adicione alguém acima."));
  equipe.forEach((m) => {
    const r = el("div", "tm-r"), av = el("div", "tm-av", (m.nick || m.valor || "?")[0].toUpperCase()), info = el("div", "tm-i");
    const idRow = el("div", "tm-idr"), idTxt = m.valor || m.key;
    const cp = el("button", "tm-cp"); cp.type = "button"; cp.title = m.tipo === "discord" ? "Copiar ID" : "Copiar e-mail"; cp.setAttribute("aria-label", cp.title);
    const SVG_COPIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
    cp.innerHTML = SVG_COPIAR;
    cp.onclick = async () => {
      try { await navigator.clipboard.writeText(String(idTxt)); }
      catch { const t = document.createElement("textarea"); t.value = String(idTxt); t.style.cssText = "position:fixed;opacity:0"; document.body.append(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
      cp.classList.add("ok"); cp.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
      setTimeout(() => { cp.classList.remove("ok"); cp.innerHTML = SVG_COPIAR; }, 1200);
    };
    idRow.append(el("small", "", (m.tipo === "discord" ? "Discord · ID " : "") + idTxt), cp);
    info.append(el("b", "", m.nick || m.valor || m.key), idRow);
    const tagCargo = tagEl("r-" + m.role, LABEL_PAPEL[m.role] || m.role);
    const sel = el("select", "tm-s"); sel.setAttribute("aria-label", "Cargo");
    Object.entries(PAPEIS).forEach(([k, v]) => { const o = el("option", "", v); o.value = k; sel.append(o); });
    sel.value = m.role; sel.onchange = async () => {
      sel.disabled = true; equipeErro();
      try { const dc = await mudarCargo(m.key, sel.value, m); tagCargo.className = "rtag r-" + sel.value; tagCargo.textContent = LABEL_PAPEL[sel.value]; equipeOk("Cargo atualizado." + notaDiscord(dc)); }
      catch (e) { equipeErro(msgEq(e)); sel.value = m.role; }
      sel.disabled = false;
    };
    const x = el("button", "tm-x", "×"); x.type = "button"; x.title = "Remover da equipe"; x.setAttribute("aria-label", "Remover da equipe");
    x.onclick = async () => {
      if (!confirm(`Remover ${m.nick || m.valor} da equipe? A pessoa perde o acesso na hora.`)) return;
      try { const dc = await removerMembro(m.key, m); equipeOk("Removido da equipe." + notaDiscord(dc)); } catch (e) { equipeErro(msgEq(e)); }
    };
    r.append(av, info, tagCargo, sel, x); box.append(r);
  });
}
const DESC_CARGO = { dono: "Controle total do site.", vendedor: "Cuida das vendas e dos pedidos.", suporte: "Atende os clientes nos tickets." };
const LINHAS_PERM = [["Ver e responder tickets", true], ["Marcar Pendente / Concluído", "status"], ["Fazer reembolsos", "reembolso"], ["Gerenciar a equipe", "equipe"]];
function renderPermissoes() { // lê a tabela PERMS, então muda sozinho se você mudar quem pode o quê
  const box = $("#tmRoles"); box.replaceChildren();
  ["dono", "vendedor", "suporte"].forEach((r) => {
    const card = el("div", "tm-role r-" + r), ul = el("ul", "tm-rp");
    card.append(tagEl(r === "dono" ? "dono" : "r-" + r, LABEL_PAPEL[r]), el("p", "tm-rd", DESC_CARGO[r]));
    LINHAS_PERM.forEach(([txt, p]) => {
      const ok = p === true || (PERMS[p] || []).includes(r), li = el("li", ok ? "ok" : "no");
      li.append(el("i", "", ok ? "✓" : "✕"), el("span", "", txt)); ul.append(li);
    });
    card.append(ul); box.append(card);
  });
}
function abrirEquipe() {
  if (!can("equipe")) return;
  equipeErro(); dicaEquipe(); renderPermissoes(); renderEquipe(); open("#teamModal");
  unsubEq?.(); unsubEq = ouvirEquipe((l) => { equipe = l.sort((a, b) => String(a.nick || a.valor).localeCompare(String(b.nick || b.valor))); renderEquipe(); }, (e) => equipeErro(msgEq(e)));
}
$("#tmTipo").onchange = dicaEquipe;
$("#tmAdd").onclick = async () => {
  if (!can("equipe")) return;
  const b = $("#tmAdd"); b.disabled = true; equipeErro();
  try {
    const dc = await adicionarMembro({ tipo: $("#tmTipo").value, valor: $("#tmVal").value, role: $("#tmRole").value, nick: $("#tmNick").value }, user);
    $("#tmVal").value = ""; $("#tmNick").value = ""; equipeOk("Adicionado! A pessoa já pode entrar no site com essa conta." + notaDiscord(dc));
  } catch (e) { equipeErro(msgEq(e)); }
  b.disabled = false;
};

/* ---------- Console Nx7 (só o dono): menu lateral + status + gráficos + auditoria ---------- */
let csEstado = null, csStats = null, csPagina = "geral"; // última leitura de cada (cacheadas ao trocar de página)
const SERVICOS = [
  ["firestore", "Firebase (Firestore)"], ["discordVendas", "Discord · Avisos de venda"],
  ["discordCargos", "Discord · Cargos (Worker)"], ["discordLogs", "Discord · Logs (suporte/cargos)"],
  ["supabase", "Supabase (anexos)"], ["cloudinary", "Cloudinary (fotos)"],
];
const LABEL_TICKET = { pendente: "Pendente", concluido: "Concluído", reembolsado: "Reembolsado" };
const COR_TICKET = { pendente: "gold", concluido: "green", reembolsado: "red" };
const LABEL_SUPORTE = { aberto: "Aberto", em_andamento: "Em atendimento", aguardando_cliente: "Aguardando cliente", resolvido: "Resolvido" };
const COR_SUPORTE = { aberto: "gold", em_andamento: "blue", aguardando_cliente: "purple", resolvido: "green" };
const LABEL_CARGO = { dono: "Dono", vendedor: "Vendedor", suporte: "Suporte" };
const COR_CARGO = { dono: "gold", vendedor: "green", suporte: "blue" };

function cardServico(nome, st) {
  const cls = st.ok === true ? "ok" : st.ok === false ? "off" : "nd";
  const card = el("div", "cs-card " + cls);
  card.append(el("i", "cs-dot"), el("b", "", nome), el("small", "", st.msg));
  return card;
}
function renderStatus(box, estado) {
  box.replaceChildren();
  SERVICOS.forEach(([k, nome]) => box.append(cardServico(nome, estado?.[k] || { ok: null, msg: "Carregando…" })));
}
// gráfico simples de barras horizontais (sem lib: largura em % do maior valor)
function barChart(box, dados, labels, cores, { vazio = "Sem dados ainda." } = {}) {
  box.replaceChildren();
  const entradas = Object.entries(dados || {}).filter(([, v]) => v > 0);
  if (!entradas.length) return box.append(el("p", "empty", vazio));
  const max = Math.max(...entradas.map(([, v]) => v), 1);
  entradas.forEach(([k, v]) => {
    const row = el("div", "cs-bar-row");
    row.append(el("span", "cs-bar-label", labels?.[k] || k));
    const track = el("div", "cs-bar-track");
    const fill = el("div", "cs-bar-fill cs-bc-" + (cores?.[k] || "p")); fill.style.width = Math.round((v / max) * 100) + "%";
    track.append(fill);
    row.append(track, el("b", "cs-bar-val", String(v)));
    box.append(row);
  });
}
function statTile(box, titulo, valor, sub) {
  const t = el("div", "cs-tile"); t.append(el("span", "", titulo), el("b", "", valor));
  if (sub) t.append(el("small", "", sub));
  box.append(t);
}
function fmtAud(ts) { // Firestore Timestamp -> "dd/mm hh:mm"
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "agora";
}
function detalheAud(a) { // se a pessoa tem apelido na equipe, mostra ele no lugar da chave; sem apelido fica como estava
  const det = a.detalhe || "";
  if (a.tipo !== "cargo" || !a.alvo) return det;
  const nome = String(equipe.find((x) => x.key === a.alvo)?.nick || "").trim();
  return nome ? det.split(a.alvo).join(nome) : det;
}
function linhaAudit(a) {
  const row = el("div", "cs-au cs-au-" + a.tipo);
  row.append(
    el("span", "cs-au-tag", TIPOS_AUDITORIA[a.tipo] || a.tipo),
    el("div", "cs-au-b", `${a.quemNome || "—"} · ${a.acao}` + (a.detalhe ? ` — ${detalheAud(a)}` : "")),
    el("small", "cs-au-t", fmtAud(a.createdAt)),
  );
  return row;
}
function renderAuditoria() {
  const box = $("#csAudList");
  const lista = filtroAud === "todos" ? auditoria : auditoria.filter((a) => a.tipo === filtroAud);
  box.replaceChildren();
  if (!lista.length) return box.append(el("p", "empty", "Nada registrado ainda."));
  lista.forEach((a) => box.append(linhaAudit(a)));
}
function renderGeral() {
  renderStatus($("#csStatusMini"), csEstado);
  const tiles = $("#csTiles"); tiles.replaceChildren();
  if (csStats) {
    statTile(tiles, "Receita (concluídas)", brl(csStats.receitaConcluida), `${csStats.tickets?.concluido || 0} vendas concluídas`);
    statTile(tiles, "Reembolsado", brl(csStats.totalReembolsado), `${csStats.tickets?.reembolsado || 0} reembolsos`);
    statTile(tiles, "Chamados abertos", (csStats.suporte?.aberto || 0) + (csStats.suporte?.em_andamento || 0) + (csStats.suporte?.aguardando_cliente || 0), `${csStats.totalSuporte || 0} no total`);
    statTile(tiles, "Equipe", csStats.equipeTotal || 1, "incluindo o dono");
  }
  const recentes = $("#csRecentes"); recentes.replaceChildren();
  if (!auditoria.length) recentes.append(el("p", "empty", "Nada registrado ainda."));
  else auditoria.slice(0, 6).forEach((a) => recentes.append(linhaAudit(a)));
}
function renderVendas() { barChart($("#csChartVendas"), csStats?.tickets, LABEL_TICKET, COR_TICKET); }
function renderSuporte() { barChart($("#csChartSuporte"), csStats?.suporte, LABEL_SUPORTE, COR_SUPORTE); }
function renderEquipePg() { barChart($("#csChartEquipe"), csStats?.equipePorCargo, LABEL_CARGO, COR_CARGO, { vazio: "Só o dono por enquanto." }); }
function renderPaginaAtual() {
  ({ geral: renderGeral, servicos: () => renderStatus($("#csStatus"), csEstado), vendas: renderVendas, suporte: renderSuporte, equipe: renderEquipePg, auditoria: renderAuditoria })[csPagina]?.();
}
function irParaPagina(pg) {
  csPagina = pg;
  $$(".cs-nav-i").forEach((b) => b.classList.toggle("on", b.dataset.cs === pg));
  $$("[data-cspage]").forEach((p) => (p.hidden = p.id !== "csPage-" + pg));
  renderPaginaAtual();
}
$("#csNav")?.addEventListener("click", (e) => { const b = e.target.closest("[data-cs]"); if (b) irParaPagina(b.dataset.cs); });
$("#csFiltro")?.addEventListener("change", (e) => { filtroAud = e.target.value; renderAuditoria(); });
$("#csAtualizar")?.addEventListener("click", carregarStatusConsole);
async function carregarStatusConsole() {
  const btn = $("#csAtualizar"); if (btn) { btn.disabled = true; btn.textContent = "Verificando…"; }
  csEstado = null; renderPaginaAtual();
  const [estado, stats] = await Promise.all([verificarServicos(), estatisticasConsole().catch(() => null)]);
  csEstado = estado; csStats = stats; renderPaginaAtual();
  if (btn) { btn.disabled = false; btn.textContent = "Verificar agora"; }
}
function abrirConsole() {
  if (!isAdmin) return;
  irParaPagina("geral"); open("#consoleModal"); carregarStatusConsole();
  unsubAud?.(); unsubAud = ouvirAuditoria((l) => { auditoria = l; renderPaginaAtual(); });
}

/* ---------- Meu Perfil ---------- */
const PROVEDORES = {
  "google.com": { nome: "Google", cls: "google" },
  [DISCORD_PROVIDER_ID]: { nome: "Discord", cls: "discord" },
  password: { nome: "E-mail e senha", cls: "mail" },
};
function provIds() { return (user?.providerData || []).map((p) => p.providerId); }
const temSenha = () => provIds().includes("password");
const nomesProv = () => provIds().map((id) => PROVEDORES[id]?.nome || id);
const emailTxt = () => user?.email || (provIds().includes(DISCORD_PROVIDER_ID) ? "Não informado pelo Discord" : "Não informado");
const dataBR = (s, comHora) => {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d) ? d.toLocaleString("pt-BR", comHora ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" }) : "—";
};
const setT = (sel, txt) => { const x = $(sel); if (x) x.textContent = txt; };
const comTimeout = (p, ms, msg) => new Promise((ok, no) => {
  const t = setTimeout(() => no(new Error(msg)), ms);
  p.then((v) => { clearTimeout(t); ok(v); }, (x) => { clearTimeout(t); no(x); });
});

function pfCabecalho() {
  setT("#pfHeadName", user.displayName || (user.email || "Cliente").split("@")[0]);
  setT("#pfHeadMail", emailTxt());
}
function pfAba(nome) {
  document.querySelectorAll(".pf-tab").forEach((b) => {
    const on = b.dataset.tab === nome; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on));
  });
  const a = $("#pfPanePerfil"), b = $("#pfPaneSeg"); if (a) a.hidden = nome !== "perfil"; if (b) b.hidden = nome !== "seguranca";
}
document.querySelectorAll(".pf-tab").forEach((b) => (b.onclick = () => pfAba(b.dataset.tab)));

/* força da senha: 0 (vazio) a 4 */
const ROT_FORCA = ["", "Fraca", "Razoável", "Boa", "Forte"];
function forcaSenha(s) {
  if (!s) return 0;
  let n = 0;
  if (s.length >= 8) n++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) n++;
  if (/\d/.test(s)) n++;
  if (/[^A-Za-z0-9]/.test(s) || s.length >= 12) n++;
  return Math.max(1, n);
}
const DICA_SENHA = "Mínimo de 6 caracteres. Quanto mais longa e variada, mais forte.";
function pwReset() {
  const f = $("#pwForm"); if (!f) return;
  f.reset(); $("#pwMeter").dataset.n = "0"; setT("#pwLbl", DICA_SENHA); setT("#pwErr", ""); setT("#pwOk", "");
  f.querySelectorAll(".pw input").forEach((i) => (i.type = "password"));
  f.querySelectorAll(".pw-eye").forEach((b) => (b.textContent = "Mostrar"));
}

function openProfile() {
  newPhoto = null; removePhoto = false; $("#pfErr").textContent = ""; $("#pfFile").value = ""; setT("#pfPhotoNote", "");
  $("#pfName").value = user.displayName || ""; $("#pfMail").value = emailTxt();
  setImg($("#pfImg"), avatarOf(user));
  if ($("#pfPaneSeg")) { // layout novo (index.html atualizado)
    pfCabecalho();
    $("#pfBadges").replaceChildren(...provIds().map((id) => el("span", "pf-badge " + (PROVEDORES[id]?.cls || ""), PROVEDORES[id]?.nome || id)), ...badgesPapel());
    setT("#pfInfoMetodo", nomesProv().join(" + ") || "—");
    setT("#pfInfoCriada", dataBR(user.metadata?.creationTime));
    setT("#pfInfoAcesso", dataBR(user.metadata?.lastSignInTime, true));
    const senha = temSenha();
    $("#pwForm").hidden = !senha; $("#pwOther").hidden = senha;
    if (!senha) setT("#pwOtherTxt", `Você entra com ${nomesProv().join(" e ") || "outro método"}, então a senha dessa conta é gerenciada por lá. Para trocá-la, use as configurações de segurança do próprio serviço.`);
    pwReset(); pfAba("perfil"); pfDiscordView(); pfGoogleView();
  }
  open("#profileModal");
}
// recorta no centro e reduz para 256x256 (foto leve e padronizada)
async function lerImagem(file) {
  try { return await createImageBitmap(file); }
  catch { // alguns navegadores/arquivos falham no createImageBitmap: tenta pelo <img>
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("Não consegui ler essa imagem. Tente outra (PNG ou JPG).")); i.src = url; });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }
}
async function cropAvatar(file, size = 256) {
  const img = await lerImagem(file), w = img.width || img.naturalWidth, h = img.height || img.naturalHeight, s = Math.min(w, h);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, size, size); // PNG com fundo transparente vira branco no JPEG
  g.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.9));
  if (!blob) throw new Error("Não consegui preparar a foto. Tente outra imagem.");
  return blob;
}
$("#pfFile").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) { $("#pfErr").textContent = "Escolha uma imagem PNG, JPG, WEBP ou GIF."; e.target.value = ""; return; }
  if (f.size > 10 * 1024 * 1024) { $("#pfErr").textContent = "Imagem muito grande (máx. 10 MB)."; e.target.value = ""; return; }
  $("#pfErr").textContent = ""; newPhoto = f; removePhoto = false;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(f); $("#pfImg").src = previewUrl;
  setT("#pfPhotoNote", "Nova foto escolhida — clique em “Salvar alterações”.");
};
$("#pfRemove").onclick = () => { newPhoto = null; removePhoto = true; $("#pfFile").value = ""; $("#pfImg").src = DEFAULT_AVATAR; setT("#pfPhotoNote", "Foto removida — clique em “Salvar alterações”."); };

const MSG_FOTO = "O envio da foto demorou demais. Confira sua conexão e tente de novo.";
$("#pfForm").onsubmit = async (e) => {
  e.preventDefault(); const b = $("#pfSave"), err = $("#pfErr"); err.textContent = ""; b.disabled = true; b.textContent = "Salvando...";
  try {
    const name = $("#pfName").value.trim();
    if (name.length < 2) throw new Error("Digite um nome com pelo menos 2 caracteres.");
    let url = null; // 1) a foto primeiro: se falhar, nada é alterado pela metade
    if (newPhoto) {
      try {
        b.textContent = "Preparando foto...";
        const blob = await cropAvatar(newPhoto);
        url = await comTimeout(enviarAvatar(user.uid, blob, (p) => (b.textContent = `Enviando foto... ${Math.round(p * 100)}%`)), 60000, MSG_FOTO);
      } catch (x) {
        console.error(x);
        err.textContent = "A foto não foi salva: " + (x.message || "falha no envio.") + " (o nome não foi alterado)";
        return; // mantém o painel aberto para você ver o motivo
      }
    }
    b.textContent = "Salvando...";
    const patch = { displayName: name };
    if (url) patch.photoURL = url; else if (removePhoto) patch.photoURL = null;
    await updateProfile(user, patch);
    await user.reload().catch(() => {}); // garante que o navegador já enxerga o nome/foto novos
    newPhoto = null; removePhoto = false; setT("#pfPhotoNote", "");
    renderNav(); pfCabecalho(); setImg($("#pfImg"), avatarOf(user));
    // atualiza o nome/foto que aparecem nos tickets do próprio cliente (o painel admin lê daí); se as regras não permitirem, segue sem erro
    atualizarPerfilNosTickets(user.uid, user.displayName || name, user.photoURL || "", isAdmin).catch((x) => console.warn("tickets não atualizados:", x.code || x));
    if (msgsCache.length && !$("#ticketsView").hidden) renderMsgs(msgsCache); // atualiza o chat aberto na hora
    close("#profileModal");
  } catch (x) { console.error(x); err.textContent = x.message || "Não foi possível salvar."; }
  finally { b.disabled = false; b.textContent = "Salvar alterações"; }
};

/* ---------- Segurança: Discord (conectar / desconectar a conta) ---------- */
function pfDiscordView() {
  const box = $("#pfDiscordBox"); if (!box) return;
  const on = discordConectado();
  box.classList.toggle("on", on);
  setT("#pfDiscordStatus", on ? "Conectado" : "Não conectado");
  $("#pfDiscordErr").textContent = "";
  const btn = $("#pfDiscordBtn");
  btn.disabled = false; btn.textContent = on ? "Desconectar" : "Conectar Discord";
  btn.classList.toggle("red", on);
  btn.onclick = on ? pfDesconectarDiscord : pfConectarDiscord;
}
async function pfConectarDiscord() {
  const b = $("#pfDiscordBtn"); b.disabled = true; b.textContent = "Conectando...";
  try { await linkDiscordCore(); pfDiscordView(); }
  catch (e) { console.error(e); $("#pfDiscordErr").textContent = erroVinculo("Discord", e.code); b.disabled = false; b.textContent = "Conectar Discord"; }
}
async function pfDesconectarDiscord() {
  if (provIds().length < 2) { $("#pfDiscordErr").textContent = "Essa é sua única forma de entrar no site. Adicione e-mail/senha ou Google antes de desconectar o Discord."; return; }
  if (!confirm("Desconectar sua conta do Discord? Você vai precisar conectar de novo para comprar ou manter os cargos do servidor.")) return;
  const b = $("#pfDiscordBtn"); b.disabled = true; b.textContent = "Desconectando...";
  try { await unlink(user, DISCORD_PROVIDER_ID); await user.reload().catch(() => {}); user = auth.currentUser; renderNav(); pfDiscordView(); }
  catch (e) { console.error(e); $("#pfDiscordErr").textContent = "Não foi possível desconectar agora. Tente de novo."; b.disabled = false; b.textContent = "Desconectar"; }
}

/* ---------- Segurança: Google (conectar / desconectar a conta) ---------- */
function pfGoogleView() {
  const box = $("#pfGoogleBox"); if (!box) return;
  const on = googleConectado();
  box.classList.toggle("on", on);
  setT("#pfGoogleStatus", on ? "Conectado" : "Não conectado");
  $("#pfGoogleErr").textContent = "";
  const btn = $("#pfGoogleBtn");
  btn.disabled = false; btn.textContent = on ? "Desconectar" : "Conectar Google";
  btn.classList.toggle("red", on);
  btn.onclick = on ? pfDesconectarGoogle : pfConectarGoogle;
}
async function pfConectarGoogle() {
  const b = $("#pfGoogleBtn"); b.disabled = true; b.textContent = "Conectando...";
  try { await linkGoogleCore(); pfGoogleView(); }
  catch (e) { console.error(e); $("#pfGoogleErr").textContent = erroVinculo("Google", e.code); b.disabled = false; b.textContent = "Conectar Google"; }
}
async function pfDesconectarGoogle() {
  if (provIds().length < 2) { $("#pfGoogleErr").textContent = "Essa é sua única forma de entrar no site. Adicione e-mail/senha ou Discord antes de desconectar o Google."; return; }
  if (!confirm("Desconectar sua conta do Google?")) return;
  const b = $("#pfGoogleBtn"); b.disabled = true; b.textContent = "Desconectando...";
  try { await unlink(user, "google.com"); await user.reload().catch(() => {}); user = auth.currentUser; renderNav(); pfGoogleView(); }
  catch (e) { console.error(e); $("#pfGoogleErr").textContent = "Não foi possível desconectar agora. Tente de novo."; b.disabled = false; b.textContent = "Desconectar"; }
}

/* ---------- Segurança: trocar senha (só para contas criadas com e-mail e senha) ---------- */
document.querySelectorAll(".pw-eye").forEach((btn) => (btn.onclick = () => {
  const i = btn.previousElementSibling, mostrar = i.type === "password";
  i.type = mostrar ? "text" : "password"; btn.textContent = mostrar ? "Ocultar" : "Mostrar";
}));
$("#pwNew")?.addEventListener("input", (e) => {
  const n = forcaSenha(e.target.value);
  $("#pwMeter").dataset.n = String(n);
  setT("#pwLbl", n ? "Força da senha: " + ROT_FORCA[n] : DICA_SENHA);
});
const ERROS_SENHA = {
  "auth/invalid-credential": "A senha atual está incorreta.",
  "auth/wrong-password": "A senha atual está incorreta.",
  "auth/weak-password": "A nova senha é muito curta (mínimo 6 caracteres).",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "auth/requires-recent-login": "Por segurança, saia, entre de novo e repita a troca.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
};
$("#pwForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const atual = $("#pwCur").value, n1 = $("#pwNew").value, n2 = $("#pwNew2").value, b = $("#pwSave");
  setT("#pwErr", ""); setT("#pwOk", "");
  if (n1.length < 6) return setT("#pwErr", "A nova senha precisa ter pelo menos 6 caracteres.");
  if (n1 !== n2) return setT("#pwErr", "As senhas novas não são iguais.");
  if (n1 === atual) return setT("#pwErr", "A nova senha precisa ser diferente da atual.");
  b.disabled = true; b.textContent = "Alterando...";
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, atual)); // confirma que é você
    await updatePassword(user, n1);
    pwReset(); setT("#pwOk", "Senha alterada com sucesso.");
  } catch (x) { console.error(x); setT("#pwErr", ERROS_SENHA[x.code] ?? "Não foi possível alterar a senha. Tente de novo."); }
  b.disabled = false; b.textContent = "Alterar senha";
});
$("#pwForgot")?.addEventListener("click", async () => {
  setT("#pwErr", ""); setT("#pwOk", "");
  try { await sendPasswordResetEmail(auth, user.email); setT("#pwOk", "Enviamos um link de redefinição para " + user.email + "."); }
  catch (x) { console.error(x); setT("#pwErr", ERROS_SENHA[x.code] ?? "Não foi possível enviar o e-mail agora."); }
});

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
  else if (p.includes(DISCORD_PROVIDER_ID)) await reauthenticateWithPopup(user, new OAuthProvider(DISCORD_PROVIDER_ID));
  else if (p.includes("password")) {
    const pw = $("#dlPass").value;
    if (!pw) throw Object.assign(new Error("Digite sua senha para confirmar."), { code: "x" });
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
  }
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