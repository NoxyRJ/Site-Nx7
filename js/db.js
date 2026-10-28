// ============================================================
//  db.js — Firestore (tickets + chat em tempo real) e Storage (arquivos)
//  Fase 4: upload com progresso, cancelamento, tipos validados e erros claros.
// ============================================================
import { auth, db, storage, CLOUDINARY, SUPABASE, ADMIN_EMAIL, NOTIFY_DISCORD_URL, ROLES_URL, LOGS_URL } from "./firebase-config.js";
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, getDocs, deleteDoc, setDoc, limit }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, listAll, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// falha rápido (com mensagem) em vez de ficar tentando por minutos quando o Storage não responde
storage.maxOperationRetryTime = 20000;   // fotos de perfil, links, exclusões
storage.maxUploadRetryTime = 120000;     // anexos dos tickets

export const PRODUTOS = {
  orbs:  { nome: "Nx7 - Orbs Automatic",  preco: 25 },
  msg:   { nome: "Nx7 - Message Manager", preco: 25 },
  combo: { nome: "Combo Nx7 Completo",    preco: 40 },
};

/* ---------- arquivos aceitos (a MESMA lista precisa estar no storage.rules) ---------- */
const TIPOS = {
  pdf:  "application/pdf",
  zip:  "application/zip",
  rar:  "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
export const ARQUIVOS_ACEITOS = Object.keys(TIPOS).map((e) => "." + e).join(",");
const MAX = 50 * 1024 * 1024; // 50 MB (limite do Supabase grátis)
const extDe = (nome) => /\.([a-z0-9]+)$/i.exec(nome || "")?.[1].toLowerCase() ?? "";

// devolve uma mensagem de erro (string) ou null se o arquivo está ok
export function validarArquivo(file) {
  if (!Object.hasOwn(TIPOS, extDe(file.name))) return "Formato não aceito. Envie .zip, .rar, .7z, .pdf, .png, .jpg ou .webp.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX) return "Arquivo maior que 50 MB.";
  return null;
}

const ERROS_STORAGE = {
  "storage/unauthorized": "Sem permissão no Storage. Confira se o storage.rules foi publicado (e se o e-mail do admin está certo).",
  "storage/unauthenticated": "Sua sessão expirou. Saia e entre de novo.",
  "storage/retry-limit-exceeded": "Não consegui falar com o Storage (a conexão caiu ou o bucket não responde). Confira o storageBucket no firebase-config.js e se o Storage está ativo.",
  "storage/quota-exceeded": "O limite de armazenamento do Firebase foi atingido.",
  "storage/bucket-not-found": "O bucket do Storage não existe. Ative o Storage no Firebase Console e confira o storageBucket no firebase-config.js.",
  "storage/project-not-found": "Projeto do Firebase não encontrado. Confira o firebase-config.js.",
  "storage/server-file-wrong-size": "O arquivo chegou corrompido. Tente enviar de novo.",
};
const comCodigo = (msg, e) => Object.assign(new Error(msg), { code: e?.code });
const erroUpload = (e) => (ERROS_STORAGE[e?.code] ? comCodigo(ERROS_STORAGE[e.code], e) : e);

export async function criarTicket(user, key) {
  const p = PRODUTOS[key];
  const t = await addDoc(collection(db, "tickets"), {
    uid: user.uid, userName: user.displayName || (user.email || "Cliente").split("@")[0],
    userEmail: user.email || "", userPhoto: user.photoURL || "",
    discordId: discordIdDe(user), // só existe se entrou com Discord: é por ele que o cargo COMPRADOR é dado
    product: key, productName: p.nome, price: p.preco, status: "pendente",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await enviarMensagem(t.id, user, { text: `Olá! Quero o pedido: ${p.nome} (R$ ${p.preco},00).` }, false);
  avisarDiscord({ evento: "pedido_novo", ticketId: t.id });
  return t.id;
}

// aviso no Discord (Cloudflare Worker) — nunca trava o site se o Discord estiver fora do ar.
// Manda o idToken do Firebase: o Worker confere quem chamou e lê o ticket direto do Firestore (ninguém forja aviso).
async function avisarDiscord(dados) {
  if (!NOTIFY_DISCORD_URL) return; // ainda não colou a URL do Worker no firebase-config.js
  try {
    const idToken = await auth.currentUser?.getIdToken();
    await fetch(NOTIFY_DISCORD_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...dados, idToken }),
    });
  } catch (e) { console.warn("Aviso no Discord falhou:", e); }
}
// chamado quando a equipe marca o ticket como CONCLUÍDO: "fulano comprou X"
export const avisarVendaConcluida = (ticketId) => avisarDiscord({ evento: "venda_concluida", ticketId });
// ---- Webhooks novos (Worker discord-logs-worker.js): chamado de suporte + cargos ----
// Igual ao avisarDiscord: manda o idToken, o Worker confere quem chamou e nunca trava o site. Devolve true se o Worker aceitou.
async function avisarLog(dados) {
  if (!LOGS_URL) return false;
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const r = await fetch(LOGS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...dados, idToken }) });
    return r.ok;
  } catch (e) { console.warn("Log no Discord falhou:", e); return false; }
}
// resumo curto do que o Worker de cargos respondeu (vai no log: "ok", "not_in_guild", "sem_discord"...)
const resumoDiscord = (dc) => (dc?.skipped ? String(dc.skipped) : dc?.ok === false ? String(dc.reason || "erro") : "ok");
const logCargo = (d) => { avisarLog({ evento: "cargo", ...d }); };   // sem await: é só um aviso

// chamado quando alguém abre um chamado de suporte -> webhook de SUPORTE (se o LOGS_URL não estiver configurado ou falhar, usa o aviso antigo)
export async function avisarSuporteNovo(ticketId) {
  if (await avisarLog({ evento: "suporte_novo", ticketId })) return;
  avisarDiscord({ evento: "suporte_novo", ticketId });
}
// status do chamado mudou (assumiu / aguardando / resolvido / reabriu): o Worker edita a mensagem do chamado no Discord
export const atualizarAvisoSuporte = (ticketId) => { avisarLog({ evento: "suporte_status", ticketId }); };

// admin = todos os tickets | cliente = só os dele (ordenação feita no app.js)
export function ouvirTickets(user, admin, cb) {
  const q = admin ? query(collection(db, "tickets"), orderBy("updatedAt", "desc"))
                  : query(collection(db, "tickets"), where("uid", "==", user.uid));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(e));
}

export function ouvirMensagens(ticketId, cb, colecao = "tickets") {
  const q = query(collection(db, colecao, ticketId, "messages"), orderBy("createdAt"));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(e));
}

/**
 * Envia uma mensagem (texto e/ou arquivo).
 *  1) sobe o arquivo para  tickets/{ticketId}/{timestamp}-{nome}  no Storage
 *  2) salva o link (fileUrl) + nome/tipo/tamanho na mensagem do Firestore
 * onProgress({ sent, total, pct })  -> pct vai de 0 a 1
 * onTask(task)                      -> recebe a tarefa de upload (task.cancel() cancela)
 */
export async function enviarMensagem(ticketId, user, { text = "", file = null, onProgress, onTask, role, colecao = "tickets" } = {}, isAdmin = false) {
  const cargo = isAdmin ? (role === "vendedor" || role === "suporte" ? role : "dono") : "cliente";
  let anexo = null, objeto = null;

  if (file) {
    const erro = validarArquivo(file);
    if (erro) throw new Error(erro);

    const ext = extDe(file.name), tipo = TIPOS[ext];
    const seguro = file.name.replace(/[^\w.-]/g, "_").slice(-80); // sem caracteres estranhos; mantém a extensão
    const caminho = `${colecao}/${ticketId}/${Date.now()}-${seguro}`;

    const url = await enviarAnexoSupabase(file, caminho, tipo, file.name, onProgress, onTask);
    anexo = { fileUrl: url, fileName: file.name, fileType: tipo, fileSize: file.size };
  }

  try {
    await addDoc(collection(db, colecao, ticketId, "messages"), {
      uid: user.uid, name: user.displayName || (user.email || "Cliente").split("@")[0],
      photo: user.photoURL || "", isAdmin, role: cargo, text,
      fileUrl: anexo?.fileUrl ?? null, fileName: anexo?.fileName ?? null,
      fileType: anexo?.fileType ?? null, fileSize: anexo?.fileSize ?? null,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    if (objeto) deleteObject(objeto).catch(() => {}); // não deixa arquivo órfão no Storage
    throw e.code === "permission-denied" ? comCodigo("Sem permissão para enviar a mensagem. Confira as regras do Firestore.", e) : e;
  }
  // a mensagem já foi salva: se só o "updatedAt" falhar, não faz o usuário achar que o envio falhou
  const extra = colecao === "tickets" && isAdmin && cargo === "dono" ? { adminName: user.displayName || "Nx7", adminPhoto: user.photoURL || "" } : {}; // o cliente enxerga a foto atual do dono
  await updateDoc(doc(db, colecao, ticketId), { updatedAt: serverTimestamp(), ...extra }).catch((e) => console.warn(e));
}

// ---------- Equipe (vendedor / suporte) e tag de comprador ----------
// Cada membro é um documento em  staff/{chave}:  "email:fulano@gmail.com"  ou  "discord:123456789012345678"
// (o firestore.rules usa a MESMA chave para liberar o acesso).
export const PAPEIS = { vendedor: "Vendedor", suporte: "Suporte" };
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const negado = (e) => (e?.code === "permission-denied" ? Object.assign(new Error("Sem permissão. Publique o novo firestore.rules no Firebase."), { code: e.code }) : e);

// chave do usuário logado (usada quando VOCÊ cadastra alguém pelo e-mail)
export const chaveEquipe = (u) => (u.email ? "email:" + u.email.toLowerCase() : u.uid);

// cargo do usuário logado em tempo real: "vendedor" | "suporte" | null
// confere as DUAS chaves possíveis (e-mail e uid), porque um e-mail cadastrado por você pode
// corresponder a uma conta que entrou com e-mail/senha ainda não verificado (ou com Discord) —
// nesse caso o e-mail sozinho não identificava a conta, e o cargo "sumia".
export function ouvirMeuPapel(u, cb) {
  // login com Discord (OIDC): o uid do Firebase é aleatório; o ID real do Discord está no providerData
  const dc = (u.providerData || []).find((p) => p.providerId === "oidc.discord")?.uid;
  const chaves = [...new Set([
    u.email ? "email:" + u.email.toLowerCase() : null,
    dc ? "discord:" + dc : null,
    u.uid,
  ].filter(Boolean))];
  const achados = {};
  const emitir = () => cb(chaves.map((k) => achados[k]).find((r) => r) || null);
  const unsubs = chaves.map((k) => onSnapshot(doc(db, "staff", k),
    (s) => { achados[k] = s.exists() && PAPEIS[s.data().role] ? s.data().role : null; emitir(); },
    (e) => { // sem permissão para ler essa chave costuma ser normal (o cargo pode estar na OUTRA chave);
      achados[k] = null; emitir();           // mas avisa no console pra ajudar a achar o problema se o cargo não aparecer de jeito nenhum
      if (e.code === "permission-denied") console.warn(`[equipe] staff/${k}: sem permissão pra ler. Se este é o seu cargo, publique o firestore.rules mais recente no Firebase.`);
      else console.warn(`[equipe] staff/${k}:`, e);
    }));
  return () => unsubs.forEach((u) => u());
}
export function ouvirEquipe(cb, onErr) {
  return onSnapshot(collection(db, "staff"), (s) => cb(s.docs.map((x) => ({ key: x.id, ...x.data() }))), (e) => onErr?.(negado(e)));
}
// ---------- Cargos no Discord (via Worker com bot) ----------
// ID do Discord de quem entrou pelo login "Entrar com Discord" (ou null)
export const discordIdDe = (u) => (u?.providerData || []).find((p) => p.providerId === "oidc.discord")?.uid || null;

// Pede ao Worker para dar/tirar cargos. Nunca lança erro: o site não pode travar se o Discord estiver fora.
// Devolve { ok, reason?, skipped? }. reason: "not_in_guild" (pessoa não está no servidor), "bot_sem_permissao", ...
export async function sincronizarDiscord(user, corpo) {
  if (!ROLES_URL || !user) return { ok: true, skipped: "nao_configurado" };
  try {
    const idToken = await user.getIdToken();
    const r = await fetch(ROLES_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, ...corpo }) });
    const j = await r.json().catch(() => ({ ok: false, reason: "resposta_invalida" }));
    if (j.ok === false) console.warn("[discord] cargo não atualizado:", j);
    if (corpo.action === "buyer") logCargo({ tipo: "comprador", acao: corpo.grant ? "adicionado" : "removido", ticketId: corpo.ticketId, discord: resumoDiscord(j) });
    return j;
  } catch (e) {
    console.warn("[discord] Worker fora do ar:", e);
    if (corpo.action === "buyer") logCargo({ tipo: "comprador", acao: corpo.grant ? "adicionado" : "removido", ticketId: corpo.ticketId, discord: "rede" });
    return { ok: false, reason: "rede" };
  }
}
const nomeOuId = (nick, key) => String(nick || "").trim() || key; // sem apelido, mostra a chave como antes
const idDaChave = (key) => (String(key).startsWith("discord:") ? String(key).slice(8) : null); // "discord:123" -> "123"

export async function adicionarMembro({ tipo, valor, role, nick }, quem) {
  valor = String(valor || "").trim();
  if (!PAPEIS[role]) throw new Error("Escolha um cargo.");
  let key;
  if (tipo === "discord") {
    if (!/^\d{15,21}$/.test(valor)) throw new Error("ID do Discord inválido: são só números (17 a 20 dígitos).");
    key = "discord:" + valor;
  } else {
    valor = valor.toLowerCase();
    if (!emailOk(valor)) throw new Error("E-mail inválido.");
    if (valor === String(ADMIN_EMAIL).toLowerCase()) throw new Error("Esse e-mail já é o do dono.");
    key = "email:" + valor;
  }
  try {
    await setDoc(doc(db, "staff", key), { role, tipo: tipo === "discord" ? "discord" : "email", valor, nick: String(nick || "").trim().slice(0, 40),
      addedBy: quem?.email || quem?.uid || "", addedAt: serverTimestamp() });
  } catch (e) { throw negado(e); }
  // cargo no Discord: só dá para pelo ID do Discord (cadastro por e-mail não tem como saber quem é no Discord)
  const dc = tipo === "discord" ? await sincronizarDiscord(quem, { action: "staff", discordId: valor, role }) : { ok: true, skipped: "sem_discord" };
  logCargo({ tipo: "staff", acao: "adicionado", alvo: key, nick: String(nick || "").trim().slice(0, 40), role, anterior: null, discord: resumoDiscord(dc) });
  registrarAuditoria("cargo", "adicionado", { alvo: key, detalhe: `${nomeOuId(nick, key)} → ${PAPEIS[role]}` }, quem);
  return dc;
}
// antes = o membro como estava na lista ({ role, nick }) — só serve para o log dizer "de X para Y"
export async function mudarCargo(key, role, antes = {}) {
  if (!PAPEIS[role]) throw new Error("Cargo inválido.");
  try { await updateDoc(doc(db, "staff", key), { role }); } catch (e) { throw negado(e); }
  const id = idDaChave(key);
  const dc = id ? await sincronizarDiscord(auth.currentUser, { action: "staff", discordId: id, role }) : { ok: true, skipped: "sem_discord" };
  logCargo({ tipo: "staff", acao: "alterado", alvo: key, nick: String(antes.nick || "").slice(0, 40), role, anterior: PAPEIS[antes.role] ? antes.role : null, discord: resumoDiscord(dc) });
  registrarAuditoria("cargo", "alterado", { alvo: key, detalhe: `${nomeOuId(antes.nick, key)}: ${PAPEIS[antes.role] || "—"} → ${PAPEIS[role]}` }, auth.currentUser);
  return dc;
}
export async function removerMembro(key, antes = {}) {
  try { await deleteDoc(doc(db, "staff", key)); } catch (e) { throw negado(e); }
  const id = idDaChave(key);
  const dc = id ? await sincronizarDiscord(auth.currentUser, { action: "staff", discordId: id, role: null }) : { ok: true, skipped: "sem_discord" };
  logCargo({ tipo: "staff", acao: "removido", alvo: key, nick: String(antes.nick || "").slice(0, 40), role: null, anterior: PAPEIS[antes.role] ? antes.role : null, discord: resumoDiscord(dc) });
  registrarAuditoria("cargo", "removido", { alvo: key, detalhe: `${nomeOuId(antes.nick, key)} (era ${PAPEIS[antes.role] || "—"})` }, auth.currentUser);
  return dc;
}
// "Comprador" = tem pelo menos um ticket concluído (reembolsado deixa de contar)
export async function ehComprador(uid) {
  const s = await getDocs(query(collection(db, "tickets"), where("uid", "==", uid), where("status", "==", "concluido"), limit(1)));
  return !s.empty;
}

// ---------- Auditoria (console do dono) ----------
// Backup no site do que os Workers avisam no Discord: a equipe consegue CRIAR o registro (ao fazer a ação),
// mas só o dono consegue LER ou APAGAR (firestore.rules). Se alguém apagar a mensagem do bot no Discord
// para esconder uma venda, cargo ou reembolso, o registro continua aqui, intocável pela equipe.
export const TIPOS_AUDITORIA = { venda: "Venda", reembolso: "Reembolso", cargo: "Equipe/cargos", suporte: "Suporte" };
export async function registrarAuditoria(tipo, acao, { alvo = "", detalhe = "" } = {}, quem, papelAtual) {
  if (!quem) return;
  const role = String(quem.email || "").toLowerCase() === String(ADMIN_EMAIL).toLowerCase() ? "dono" : (papelAtual || "");
  if (!role) return; // sem cargo conhecido: as regras recusariam o registro mesmo assim
  try {
    await addDoc(collection(db, "audit"), {
      tipo, acao, alvo: String(alvo || ""), detalhe: String(detalhe || "").slice(0, 300),
      quemUid: quem.uid, quemNome: quem.displayName || quem.email || "—", quemChave: chaveEquipe(quem), quemRole: role,
      createdAt: serverTimestamp(),
    });
  } catch (e) { console.warn("[auditoria] não foi possível registrar:", e); } // nunca trava a ação principal
}
export function ouvirAuditoria(cb, max = 300) {
  const q = query(collection(db, "audit"), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(e));
}

// ---------- Console: contagens, receita e status dos serviços externos ----------
export async function estatisticasConsole() {
  const [tk, sp, eq] = await Promise.all([
    getDocs(collection(db, "tickets")), getDocs(collection(db, "suporte")), getDocs(collection(db, "staff")),
  ]);
  const porCampo = (snap, campo) => snap.docs.reduce((a, d) => { const k = d.data()[campo] || "—"; a[k] = (a[k] || 0) + 1; return a; }, {});
  const soma = (snap, cond, campo) => snap.docs.reduce((t, d) => (cond(d.data()) ? t + (Number(d.data()[campo]) || 0) : t), 0);
  return {
    tickets: porCampo(tk, "status"), totalTickets: tk.size,
    receitaConcluida: soma(tk, (t) => t.status === "concluido", "price"),
    totalReembolsado: soma(tk, (t) => t.status === "reembolsado", "refundAmount"),
    suporte: porCampo(sp, "status"), totalSuporte: sp.size,
    equipePorCargo: { dono: 1, ...porCampo(eq, "role") }, equipeTotal: eq.size + 1,
  };
}
// Qualquer resposta HTTP (mesmo erro 4xx/5xx) prova que o serviço está de pé; só falha de rede/CORS/tempo esgotado conta como fora do ar.
async function pingUrl(url, opts = {}) {
  if (!url) return { ok: null, msg: "Não configurado" };
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store", signal: ctrl.signal });
    return { ok: true, msg: r.type === "opaque" ? "Respondendo" : `Respondendo (HTTP ${r.status})` };
  } catch (e) {
    return { ok: false, msg: e.name === "AbortError" ? "Sem resposta (tempo esgotado)" : "Não alcançável (sem rede ou bloqueado)" };
  } finally { clearTimeout(timer); }
}
async function pingFirestore() {
  try { await getDocs(query(collection(db, "tickets"), limit(1))); return { ok: true, msg: "Conectado" }; }
  catch (e) { return { ok: false, msg: e.code === "permission-denied" ? "Sem permissão (confira o firestore.rules)" : "Falha de conexão" }; }
}
export async function verificarServicos() {
  const [firestore, discordVendas, discordCargos, discordLogs, supabase, cloudinary] = await Promise.all([
    pingFirestore(),
    pingUrl(NOTIFY_DISCORD_URL),
    pingUrl(ROLES_URL),
    pingUrl(LOGS_URL),
    pingUrl(supabaseOk() ? `${SUPABASE.url.replace(/\/+$/, "")}/storage/v1/object/public/${encodeURIComponent(SUPABASE.bucket)}/__ping__` : null),
    pingUrl(cloudinaryOk() ? `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY.cloud)}/image/upload` : null),
  ]);
  return { firestore, discordVendas, discordCargos, discordLogs, supabase, cloudinary };
}

// ---------- Status do ticket (Fase 3) ----------
const STATUS_VALIDOS = ["pendente", "concluido", "reembolsado"];

export async function definirStatus(ticketId, status, limparReembolso = false) {
  if (!ticketId) throw new Error("Ticket inválido.");
  if (!STATUS_VALIDOS.includes(status)) throw new Error("Status inválido.");
  try {
    await updateDoc(doc(db, "tickets", ticketId), {
      status,                       // "pendente" | "concluido" | "reembolsado"
      updatedAt: serverTimestamp(),
      ...(limparReembolso ? { refundedAt: null, refundReason: null, refundAmount: null } : {}), // saiu de "reembolsado"
    });
  } catch (e) {
    if (e.code === "permission-denied")
      throw new Error("Sem permissão para alterar o status. Verifique as regras do Firestore.");
    throw e;
  }
}

// ---------- Reembolso (admin) ----------
// Marca o ticket como "reembolsado" e avisa o cliente no chat. A devolução do dinheiro em si (PIX etc.) é feita por você, fora do site.
export async function reembolsarTicket(ticketId, user, { motivo = "", obs = "", valor = 0, file = null, onProgress } = {}) {
  if (!ticketId) throw new Error("Ticket inválido.");
  if (file) { const erro = validarArquivo(file); if (erro) throw new Error(erro); } // valida antes de mexer no ticket
  const razao = [motivo, obs].filter(Boolean).join(" — ").slice(0, 400);
  const v = Number(valor) || 0;
  try {
    await updateDoc(doc(db, "tickets", ticketId), {
      status: "reembolsado", refundedAt: serverTimestamp(), refundReason: razao, refundAmount: v, updatedAt: serverTimestamp(),
    });
  } catch (e) {
    if (e.code === "permission-denied")
      throw new Error('Sem permissão para registrar o reembolso. Confira se as regras do Firestore aceitam o status "reembolsado" e os campos refundedAt, refundReason e refundAmount.');
    throw e;
  }
  // mensagem no chat (o app.js a desenha como cartão) + comprovante opcional; o status já foi salvo
  const texto = `↺ Reembolso registrado: R$ ${v.toFixed(2).replace(".", ",")}.` + (razao ? ` Motivo: ${razao}.` : "");
  registrarAuditoria("reembolso", "registrado", { alvo: ticketId, detalhe: `R$ ${v.toFixed(2).replace(".", ",")}` + (motivo ? ` — ${motivo}` : "") }, user);
  try {
    await enviarMensagem(ticketId, user, { text: texto, file, onProgress }, true);
    return { aviso: null };
  } catch (e) {
    console.warn(e);
    if (!file) return { aviso: null };
    await enviarMensagem(ticketId, user, { text: texto }, true).catch((x) => console.warn(x)); // pelo menos o aviso chega
    return { aviso: "Reembolso registrado, mas o comprovante não foi enviado (" + (e.message || "erro") + "). Anexe o comprovante no chat." };
  }
}

// ---------- Fase 2: perfil e exclusão de conta ----------

// foto de perfil: vai para o Cloudinary (se configurado em firebase-config.js) ou, senão, para o Firebase Storage
const cloudinaryOk = () => !!(CLOUDINARY?.cloud && CLOUDINARY?.preset);

function enviarParaCloudinary(blob, onProgress) {
  return new Promise((ok, no) => {
    const fd = new FormData();
    fd.append("file", blob, "avatar.jpg"); fd.append("upload_preset", CLOUDINARY.preset);
    const x = new XMLHttpRequest();
    x.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY.cloud)}/image/upload`);
    x.timeout = 45000;
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => {
      let r = {}; try { r = JSON.parse(x.responseText); } catch {}
      if (x.status >= 200 && x.status < 300 && /^https:\/\//.test(r.secure_url || "")) return ok(r.secure_url);
      const m = r?.error?.message || "";
      no(new Error(/preset/i.test(m) ? `O preset "${CLOUDINARY.preset}" não existe ou não está como Unsigned no Cloudinary. (${m})`
        : /cloud name|invalid.*cloud/i.test(m) || x.status === 401 || x.status === 404 ? `Confira o "Cloud name" no firebase-config.js. (${m || "erro " + x.status})`
        : m ? "Cloudinary: " + m : `Falha no envio da foto (erro ${x.status}).`));
    };
    x.onerror = () => no(new Error("Sem conexão com o serviço de fotos. Verifique a internet."));
    x.ontimeout = () => no(new Error("O envio da foto demorou demais. Tente de novo."));
    x.send(fd);
  });
}

// anexos dos tickets -> Supabase Storage (bucket público; o caminho tem timestamp, então o link não é adivinhável)
const supabaseOk = () => !!(SUPABASE?.url && SUPABASE?.key && SUPABASE?.bucket);

function enviarAnexoSupabase(file, caminho, tipo, nomeOriginal, onProgress, onTask) {
  return new Promise((ok, no) => {
    if (!supabaseOk()) return no(new Error("Supabase não configurado no firebase-config.js (url e key)."));
    const base = SUPABASE.url.replace(/\/+$/, "");
    const x = new XMLHttpRequest();
    x.open("POST", `${base}/storage/v1/object/${encodeURIComponent(SUPABASE.bucket)}/${caminho}`);
    x.setRequestHeader("apikey", SUPABASE.key);
    if (!SUPABASE.key.startsWith("sb_")) x.setRequestHeader("Authorization", "Bearer " + SUPABASE.key); // chaves novas (sb_publishable_...) não são JWT: só vão no apikey
    x.setRequestHeader("Content-Type", tipo);
    x.setRequestHeader("x-upsert", "false");
    x.timeout = 10 * 60 * 1000;
    onTask?.({ cancel: () => x.abort() }); // o app.js chama task.cancel()
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.({ sent: e.loaded, total: e.total, pct: e.loaded / e.total });
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        const pub = `${base}/storage/v1/object/public/${encodeURIComponent(SUPABASE.bucket)}/${caminho}`;
        return ok(tipo.startsWith("image/") ? pub : `${pub}?download=${encodeURIComponent(nomeOriginal)}`); // arquivos baixam direto, com o nome certo
      }
      let r = {}; try { r = JSON.parse(x.responseText); } catch {}
      const m = r.message || r.error || "";
      no(new Error(x.status === 413 || /too large|exceeded.*size|payload/i.test(m) ? "Arquivo maior que o limite do Supabase (50 MB no plano grátis)."
        : /bucket not found/i.test(m) || x.status === 404 ? `O bucket "${SUPABASE.bucket}" não existe. Crie-o (público) em Storage no Supabase.`
        : /row-level|policy|unauthorized/i.test(m) || x.status === 401 || x.status === 403 ? "O Supabase recusou o envio. Rode o SQL das políticas e confira a chave (anon) no firebase-config.js."
        : m ? "Supabase: " + m : `Falha no envio do arquivo (erro ${x.status}).`));
    };
    x.onabort = () => no(Object.assign(new Error("Envio cancelado."), { code: "storage/canceled" }));
    x.onerror = () => no(new Error("Sem conexão com o serviço de arquivos. Verifique a internet."));
    x.ontimeout = () => no(new Error("O envio demorou demais. Tente de novo."));
    x.send(file);
  });
}

// onProgress(0..1) mostra o andamento do envio
export async function enviarAvatar(uid, blob, onProgress) {
  if (cloudinaryOk()) return enviarParaCloudinary(blob, onProgress);
  const nome = `avatar-${Date.now()}.jpg`, r = ref(storage, `avatars/${uid}/${nome}`);
  let url;
  try {
    const task = uploadBytesResumable(r, blob, { contentType: "image/jpeg", cacheControl: "public,max-age=31536000" });
    let travou = false, timer;
    const arma = () => { clearTimeout(timer); timer = setTimeout(() => { travou = true; task.cancel(); }, 15000); }; // 15s sem avanço = Storage não responde
    arma();
    try {
      await new Promise((ok, falhou) => task.on("state_changed",
        (s) => { arma(); onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0); }, falhou, ok));
    } catch (e) {
      if (travou) throw comCodigo("O Storage não respondeu. Configure o Cloudinary em firebase-config.js (grátis) para as fotos de perfil.", { code: "storage/stalled" });
      throw e;
    } finally { clearTimeout(timer); }
    url = await getDownloadURL(r);
  } catch (e) {
    if (e?.code === "storage/unauthorized")
      throw comCodigo("O Storage recusou a foto. Publique o storage.rules ou configure o Cloudinary em firebase-config.js.", e);
    throw erroUpload(e);
  }
  listAll(ref(storage, `avatars/${uid}`))
    .then((l) => l.items.filter((i) => i.name !== nome).forEach((i) => deleteObject(i).catch(() => {})))
    .catch(() => {});
  return url;
}

// espelha o perfil atual nos tickets: o chat e a lista leem daqui para mostrar nome/foto sempre atuais.
// cliente -> userName/userPhoto nos tickets dele | dono -> adminName/adminPhoto em todos os tickets. Melhor esforço.
export async function atualizarPerfilNosTickets(uid, nome, foto, admin) {
  const q = admin ? query(collection(db, "tickets")) : query(collection(db, "tickets"), where("uid", "==", uid));
  const ts = await getDocs(q);
  const dados = admin ? { adminName: nome, adminPhoto: foto } : { userName: nome, userPhoto: foto };
  await Promise.all(ts.docs.map((t) => updateDoc(t.ref, dados)));
}

// exclusão de conta (LGPD): arquivos + mensagens -> ticket -> avatar
export async function excluirDadosDoUsuario(uid) {
  const ts = await getDocs(query(collection(db, "tickets"), where("uid", "==", uid)));
  for (const t of ts.docs) {
    const ms = await getDocs(collection(db, "tickets", t.id, "messages"));
    await Promise.all(ms.docs.map(async (m) => {
      const url = m.data().fileUrl;
      if (url && url.includes("firebasestorage")) await deleteObject(ref(storage, url)).catch(() => {}); // arquivos do Supabase não passam por aqui
      await deleteDoc(m.ref);
    }));
    try { await Promise.all((await listAll(ref(storage, `tickets/${t.id}`))).items.map(deleteObject)); } catch {} // sobras
    await deleteDoc(t.ref);
  }
  // chamados de suporte (arquivos ficam no Supabase; aqui só os documentos)
  const ss = await getDocs(query(collection(db, "suporte"), where("uid", "==", uid)));
  for (const t of ss.docs) {
    const ms = await getDocs(collection(db, "suporte", t.id, "messages"));
    await Promise.all(ms.docs.map((m) => deleteDoc(m.ref)));
    await deleteDoc(t.ref);
  }
  try { await Promise.all((await listAll(ref(storage, `avatars/${uid}`))).items.map(deleteObject)); } catch {}
}