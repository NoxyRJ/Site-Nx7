// ============================================================
//  support.js — Central de Suporte (chamados de ajuda)
//  - Cliente: abre chamado (categoria + pedido vinculado), conversa, anexa arquivos, marca como resolvido / reabre.
//  - Equipe (dono / vendedor / suporte): fila de atendimento, assumir, mudar status, respostas rápidas
//    e painel do cliente com PEDIDO VINCULADO + HISTÓRICO DE COMPRAS + chamados anteriores.
//  Coleção própria "suporte" (não mistura com os tickets de compra, então não afeta o cargo COMPRADOR).
// ============================================================
import { db } from "./firebase-config.js";
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ouvirTickets, ouvirMensagens, enviarMensagem, validarArquivo, ARQUIVOS_ACEITOS, avisarSuporteNovo, atualizarAvisoSuporte, discordIdDe, registrarAuditoria }
  from "./db.js";

// CSS da Central de Suporte: o próprio módulo injeta (não depende de editar o chat-v3.css nem de novo <link>)
const CSS = `/* ===== Central de Suporte ===== */
.sp .tv-body{grid-template-columns:350px minmax(0,1fr)}
.sp.staff.has-cur .tv-body{grid-template-columns:350px minmax(0,1fr) 340px}
.sp .tv-body{position:relative}
.sp-new{padding:10px 20px;font-size:12px;margin-left:14px}
.sp .tv-me{margin-left:auto}
.sp .ch-info{min-width:0}
.sp .ch-info b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-chback{display:none}
.sp-tools{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sp-tools[hidden]{display:none}
.sp-ctxbtn{display:none}
#spText{background:#0a0414;border:1px solid rgba(168,85,247,.3);border-radius:12px;padding:12px 14px;color:var(--tx);font:inherit;width:100%}
#spText:focus{outline:0;border-color:var(--p);box-shadow:0 0 14px rgba(168,85,247,.4)}
.sp .chat-row #spText{flex:1;min-width:0}
.sp .chat-f.busy .tbtn[for="spFile"]{opacity:.45;pointer-events:none}
#spSend:disabled{opacity:.7;cursor:wait;transform:none}
.sp-box.vazio::before{content:"Selecione um chamado na lista, ou abra um novo em “+ Novo chamado”."}

/* filtros */
.sp-flt{display:flex;gap:6px;flex-wrap:wrap}
.sp-chip{display:inline-flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-radius:999px;border:1px solid rgba(168,85,247,.35);background:rgba(255,255,255,.04);
  color:var(--mut);font:600 12.5px Inter,sans-serif;cursor:pointer;transition:.2s;white-space:nowrap}
.sp-chip b{min-width:22px;padding:2px 7px;border-radius:999px;background:rgba(168,85,247,.25);color:#e9d5ff;font:700 11px Inter,sans-serif;text-align:center}
.sp-chip:hover{color:#fff;border-color:rgba(168,85,247,.75)}
.sp-chip.on{color:#fff;border-color:var(--p);background:rgba(168,85,247,.25);box-shadow:0 0 14px rgba(168,85,247,.35)}
.sp-chip[data-f="aberto"].on{border-color:var(--gold);background:rgba(251,191,36,.14)}
.sp-chip[data-f="em_andamento"].on{border-color:#38bdf8;background:rgba(56,189,248,.14)}
.sp-chip[data-f="aguardando_cliente"].on{border-color:#fb923c;background:rgba(251,146,60,.14)}
.sp-chip[data-f="resolvido"].on{border-color:#4ade80;background:rgba(74,222,128,.14)}

/* selos de status do chamado */
.sp-st{display:inline-flex;align-items:center;gap:6px;flex:none;max-width:none;padding:3px 10px;border-radius:999px;border:1px solid;white-space:nowrap;
  font:700 10.5px Inter,sans-serif;text-transform:uppercase;letter-spacing:.08em}
#spStatus{display:inline-flex;flex:none;max-width:100%}
.sp-st::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
.sp-st.aberto{color:var(--gold);border-color:var(--gold);background:rgba(251,191,36,.1)}
.sp-st.em_andamento{color:#38bdf8;border-color:#38bdf8;background:rgba(56,189,248,.1)}
.sp-st.aguardando_cliente{color:#fb923c;border-color:#fb923c;background:rgba(251,146,60,.1)}
.sp-st.resolvido{color:#4ade80;border-color:#4ade80;background:rgba(74,222,128,.12)}
.sp-st.resolvido::before{content:"✓";width:auto;height:auto;background:none;box-shadow:none;font-weight:900}

/* itens da lista */
.sp-i,.sp-row,.sp-sec,.sp-order,.sp-ctx{box-sizing:border-box}
.sp .tv-list{min-width:0;overflow-x:hidden}
.sp-i{min-width:0;max-width:100%;grid-template-columns:minmax(0,1fr)}
.sp-row-i,.sp-l2{min-width:0}
.sp-l1 .sp-t{flex:1}
.sp-i{display:grid;gap:7px;width:100%;text-align:left;margin-bottom:10px;padding:13px 15px;border-radius:14px;background:rgba(30,12,60,.55);
  border:1px solid rgba(168,85,247,.25);color:var(--tx);cursor:pointer;font:inherit;transition:.2s}
.sp-i:hover{border-color:rgba(168,85,247,.6)}
.sp-i.on{border-color:var(--p);box-shadow:0 0 20px rgba(168,85,247,.4)}
.sp-i.done{opacity:.72}
.sp-l1{display:flex;align-items:center;justify-content:space-between;gap:10px}
.sp-t{min-width:0;font:700 14.5px Inter,sans-serif;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-l2{display:flex;gap:6px;align-items:center;color:var(--mut);font-size:13px;min-width:0}
.sp-l2 span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-dot{opacity:.5}
.sp-tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.sp-id{font:700 10.5px Orbitron,sans-serif;letter-spacing:.07em;color:#cdb8f5;padding:2px 8px;border-radius:6px;background:rgba(168,85,247,.14);border:1px solid rgba(168,85,247,.25)}
.sp-pr{font:700 10.5px Inter,sans-serif;color:#fca5a5;padding:2px 8px;border-radius:6px;background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.4)}
.sp-ped{font:600 11px Inter,sans-serif;color:var(--gold);padding:2px 8px;border-radius:6px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.35)}
.sp-who{font:600 11px Inter,sans-serif;color:#bae6fd;padding:2px 8px;border-radius:6px;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3)}
.sp-who.vazio{color:var(--mut);background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12)}
.sp-ft{font-size:12px;color:var(--mut);padding-top:7px;border-top:1px dashed rgba(168,85,247,.28)}
.sp-empty{display:grid;gap:6px;text-align:center;padding:30px 12px;color:var(--mut)}
.sp-empty b{color:#fff;font-size:15px}
.sp-err{color:#fca5a5}

/* faixa do pedido vinculado */
.sp-order{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(124,58,237,.18));border:1px solid rgba(251,191,36,.45)}
.sp-order[hidden]{display:none}
.sp-o-ic{flex:none;width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#d97706,var(--gold));color:#2a1700}
.sp-o-ic .ic{width:20px;height:20px}
.sp-o-i{flex:1;min-width:0;display:grid}
.sp-o-i small{font:700 10px Orbitron,sans-serif;letter-spacing:.12em;color:var(--gold)}
.sp-o-i b{font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-o-i span{font-size:12.5px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-order .stt.reembolsado,.sp-row .stt.reembolsado{color:#fb7185;border-color:#fb7185;background:rgba(251,113,133,.1)}
.sp-order .stt,.sp-row .stt{flex:none;font-size:10px;padding:2px 8px}
.sp-order .stt.pendente::before,.sp-row .stt.pendente::before{content:"●";font-size:8px}
.sp-order .stt.concluido::before,.sp-row .stt.concluido::before{content:"✓";font-weight:900}

/* mensagens de sistema (linha do tempo) */
.sp-sys{align-self:center;display:flex;align-items:center;gap:10px;margin:10px 0 2px;padding:5px 14px;border-radius:999px;font-size:12.5px;color:#d8c8f5;
  background:rgba(168,85,247,.1);border:1px dashed rgba(168,85,247,.4);max-width:92%}
.sp-sys time{color:var(--mut);font-size:11px;flex:none}
.sp-closed{padding:12px 14px;border-radius:12px;text-align:center;font-size:14px;color:#bbf7d0;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.35)}
.sp-closed[hidden]{display:none}
.sp-macro[hidden]{display:none}
.sp-macro select,.sp-sel{height:40px;border-radius:10px;border:1px solid rgba(168,85,247,.45);background:rgba(8,3,18,.85);color:#fff;font:600 13px Inter,sans-serif;padding:0 12px;cursor:pointer}
.sp-macro select{width:100%}
.sp-sel:focus,.sp-macro select:focus{outline:2px solid var(--gold);outline-offset:1px}

/* painel do cliente (equipe) */
.sp-ctx{position:relative;overflow:auto;display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:14px;padding:16px;border-left:1px solid rgba(168,85,247,.25);background:rgba(8,3,18,.55)}
.sp-ctx[hidden]{display:none}
.sp-ctx-x{display:none;position:absolute;top:8px;right:10px;background:none;border:0;color:var(--mut);font-size:26px;cursor:pointer;line-height:1}
.sp-sec{display:grid;gap:10px;width:100%;max-width:none;margin:0;box-sizing:border-box;padding:14px;border-radius:14px;background:rgba(30,12,60,.45);border:1px solid rgba(168,85,247,.22)}
.sp-sec h4{font:700 11px Orbitron,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.sp-cl{display:flex;align-items:center;gap:12px;min-width:0}
.sp-cl-n{display:grid;min-width:0}
.sp-cl-n b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-cl-n small{color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sp-kpi div{display:grid;gap:2px;padding:9px 6px;border-radius:12px;text-align:center;background:rgba(10,4,20,.7);border:1px solid rgba(168,85,247,.2)}
.sp-kpi b{font:800 14px Orbitron,sans-serif;color:#fff;overflow:hidden;text-overflow:ellipsis}
.sp-kpi span{font-size:11px;color:var(--mut)}
.sp-kv{display:grid;border:1px solid rgba(168,85,247,.2);border-radius:12px;overflow:hidden}
.sp-kv div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 12px;font-size:13px;background:rgba(10,4,20,.6)}
.sp-kv div+div{border-top:1px solid rgba(168,85,247,.16)}
.sp-kv span{color:var(--mut);flex:none}
.sp-kv b{font-weight:600;text-align:right;min-width:0;overflow-wrap:anywhere}
.sp-lista{display:grid;gap:8px}
.sp-mut{color:var(--mut);font-size:13px}
.sp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:10px 12px;border-radius:12px;cursor:pointer;
  background:rgba(10,4,20,.7);border:1px solid rgba(168,85,247,.22);color:var(--tx);font:inherit;transition:.2s}
.sp-row:hover{border-color:var(--p);box-shadow:0 0 14px rgba(168,85,247,.3)}
.sp-row.hl{border-color:var(--gold);background:rgba(251,191,36,.08)}
.sp-row-i{display:grid;min-width:0}
.sp-row-i b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-row-i small{color:var(--mut);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* cartão de pedido (pedido vinculado + histórico) */
.sp-ord{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 12px;width:100%;box-sizing:border-box;text-align:left;padding:12px 14px;border-radius:14px;cursor:pointer;
  background:rgba(10,4,20,.7);border:1px solid rgba(168,85,247,.22);color:var(--tx);font:inherit;transition:.2s}
.sp-ord:hover{border-color:var(--p);box-shadow:0 0 14px rgba(168,85,247,.3)}
.sp-ord.hl{border-color:var(--gold);background:linear-gradient(135deg,rgba(251,191,36,.11),rgba(124,58,237,.14))}
.sp-ord-n{grid-column:1/-1;font:700 14.5px/1.35 Inter,sans-serif;color:#fff;overflow-wrap:anywhere}
.sp-ord-v{font:800 15px Orbitron,sans-serif;color:var(--gold);white-space:nowrap}
.sp-ord .stt{justify-self:end;flex:none;font-size:10px;padding:3px 10px;white-space:nowrap}
.sp-ord .stt.reembolsado{color:#fb7185;border-color:#fb7185;background:rgba(251,113,133,.1)}
.sp-ord .stt.pendente::before{content:"●";font-size:8px}
.sp-ord .stt.concluido::before{content:"✓";font-weight:900}
.sp-ord-m{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:2px 10px;padding-top:7px;border-top:1px dashed rgba(168,85,247,.22);font-size:12px;color:var(--mut)}
.sp-ord-m span+span::before{content:"•";margin-right:10px;opacity:.5}

/* tela "nenhum chamado selecionado": cartão central com o botão de novo chamado */
.sp-es{display:none}
.sp:not(.has-cur) .tv-chat>:not(.sp-es){display:none!important}
.sp:not(.has-cur) .sp-es{display:flex}
.sp-es{flex:1;min-height:0;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:40px 24px;border-radius:20px;
  border:1px dashed rgba(168,85,247,.38);background:radial-gradient(60% 55% at 50% 36%,rgba(124,58,237,.26),transparent 72%),rgba(10,4,20,.55)}
.sp-es-ic{width:88px;height:88px;border-radius:26px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(124,58,237,.38),rgba(251,191,36,.18));
  border:1px solid rgba(168,85,247,.55);box-shadow:0 0 44px rgba(168,85,247,.38),inset 0 1px 0 rgba(255,255,255,.12);animation:sp-flut 3.6s ease-in-out infinite}
.sp-es-ic .ic{width:44px;height:44px}
.sp-es h3{margin:0;font:800 23px Orbitron,sans-serif;color:#fff;letter-spacing:.02em}
.sp-es p{margin:0;max-width:430px;color:var(--mut);font-size:15px;line-height:1.6}
.sp-es-info{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;font:600 12.5px Inter,sans-serif;color:#e9d5ff;
  background:rgba(168,85,247,.14);border:1px solid rgba(168,85,247,.38)}
.sp-es-info[hidden]{display:none}
.sp-es-info::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold)}
.sp-es-btn{margin-top:8px;padding:15px 38px;font-size:14px}
@keyframes sp-flut{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@media(prefers-reduced-motion:reduce){.sp-es-ic{animation:none}}
@media(min-width:761px){.sp:not(.has-cur) .sp-new{display:none}}

/* modal de novo chamado */
.sp-mbox{max-width:520px;gap:10px}
.sp-lbl{font:600 12px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);margin-bottom:-4px;display:flex;justify-content:space-between}
.sp-lbl small{text-transform:none;letter-spacing:0;font-weight:500}
#spModal select,#spModal textarea{width:100%;border-radius:14px;border:1px solid rgba(168,85,247,.4);background:rgba(8,3,18,.8);color:#fff;font:400 15px Inter,sans-serif;padding:12px 14px}
#spModal textarea{min-height:130px;resize:vertical}
#spModal select:focus,#spModal textarea:focus{outline:2px solid var(--gold);outline-offset:1px}

/* telas médias: painel do cliente vira gaveta */
@media(max-width:1180px){
  .sp.staff.has-cur .tv-body{grid-template-columns:350px minmax(0,1fr)}
  .sp-ctxbtn{display:inline-block}
  .sp-ctx{position:absolute;top:0;right:0;bottom:0;width:min(380px,92vw);z-index:6;background:#0a0414;box-shadow:-20px 0 50px rgba(0,0,0,.6);transform:translateX(105%);transition:transform .25s}
  .sp.ctx-open .sp-ctx{transform:none}
  .sp-ctx-x{display:block}
  .sp-ctx{padding-top:46px}
}
@media(max-width:760px){
  .sp .tv-body,.sp.staff.has-cur .tv-body{grid-template-columns:1fr}
  .sp-chback{display:inline-block}
  .sp-tools{margin-left:0;width:100%}
  .sp-tools>*{flex:1}
  .sp .tv-top{flex-wrap:wrap;gap:8px 10px;padding:10px 14px}
  #spBack{order:1;flex:none;padding:9px 12px}
  .sp-new{order:2;flex:none;margin-left:auto;padding:10px 16px;font-size:12px;white-space:nowrap}
  .sp .tv-top .o{order:3;flex:1 0 100%;font-size:14px;white-space:normal}
  .sp .tv-me{display:none}
  .sp-ctx{top:0;width:100%;padding:46px 14px 24px}
  .sp-ctx-x{top:6px;right:8px;width:38px;height:38px;font-size:30px}
  .sp-order{flex-wrap:wrap;row-gap:8px}
  .sp-o-i{flex:1 1 150px}
  .sp-o-i b{white-space:normal;overflow-wrap:anywhere}
  .sp-order .tbtn{margin-left:auto}
  .sp .chat-h{gap:8px}
  .sp .chat-h .ch-info{flex:1 1 140px}
  .sp-tools>*{min-width:0}
}
`;
function injetarCss() {
  if (document.getElementById("sp-css")) return;
  const st = document.createElement("style"); st.id = "sp-css"; st.textContent = CSS; document.head.append(st); // vai por último: vence as regras antigas
}

const $ = (s) => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

const CATS = {
  compra: "Dúvida sobre compra", acesso: "Não recebi / acesso ao produto", tecnico: "Problema técnico",
  pagamento: "Pagamento ou reembolso", conta: "Minha conta", outro: "Outro assunto",
};
const STS = { aberto: "Aberto", em_andamento: "Em atendimento", aguardando_cliente: "Aguardando cliente", resolvido: "Resolvido" };
const FILTROS = [["todos", "Todos"], ["aberto", "Abertos"], ["em_andamento", "Em atendimento"], ["aguardando_cliente", "Aguardando cliente"], ["resolvido", "Resolvidos"]];
const ORD = { pendente: "Pendente", concluido: "Concluído", reembolsado: "Reembolsado" };
const MACROS = [
  ["Estou analisando", "Olá! Já estou analisando o seu caso e retorno em breve."],
  ["Pedir print + pedido", "Pode me enviar um print do problema e o ID do seu pedido (aparece em Meus Tickets)? Assim eu resolvo mais rápido."],
  ["Pagamento pendente", "Seu pedido ainda consta como pendente. Assim que o pagamento for confirmado, o seu acesso é liberado por aqui."],
  ["Reiniciar e testar", "Tente fechar tudo, reiniciar o script e entrar novamente. Se continuar, me avise com um print do que aparece."],
  ["Encerrar chamado", "Vou dar este chamado como resolvido. Se precisar de mais alguma coisa, é só reabrir. 💜"],
];
const PAPEIS = { dono: "DONO", vendedor: "VENDEDOR", suporte: "SUPORTE" };

const brl = (v) => "R$ " + Number(v ?? 0).toFixed(2).replace(".", ",");
const fmtBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace(".", ",")} MB`;
const ms = (t) => t?.toMillis?.() ?? Date.now();
const fmt = (t) => (t?.toDate ? t.toDate().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const horaDe = (t) => (t?.toDate ? t.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "enviando…");
const proto = (id) => "SUP-" + id.slice(0, 6).toUpperCase();
const pedId = (id) => "#" + id.slice(0, 6).toUpperCase();
const norm = (x) => String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function rotuloDia(d) {
  const h = new Date(), o = new Date(); o.setDate(h.getDate() - 1);
  if (d.toDateString() === h.toDateString()) return "Hoje";
  if (d.toDateString() === o.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

const S = {
  user: null, papel: null, staff: false, isOpen: false,
  lista: [], orders: [], ctxOrders: [], cur: null, msgs: [], filtro: "todos", busca: "", selecionar: null, erro: "",
  uList: null, uOrd: null, uMsg: null, uCtx: null, focoAntes: null, // foco de antes de abrir o painel (devolvido ao fechar)
};
// acessibilidade: prende o Tab dentro do painel enquanto ele estiver realmente em primeiro plano (sem modal por cima)
const focaveisSp = (c) => Array.from(c.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((e) => e.offsetParent !== null);
document.addEventListener("DOMContentLoaded", () => {
  const painel = $("#supportView"); if (!painel) return;
  painel.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || painel.hidden || document.querySelector(".mdl:not([hidden])")) return;
    const f = focaveisSp(painel); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});
const U = { file: null, task: null, busy: false, thumb: null }; // anexo pendente no chat
let hooks = { abrirPedido: () => {} };

const meuNome = () => S.user?.displayName || (S.user?.email || "Cliente").split("@")[0];
const stLabel = (s) => (!S.staff && s === "aguardando_cliente" ? "Aguardando sua resposta" : STS[s] || s);
const chipSt = (s) => el("span", "sp-st " + s, stLabel(s));
const trava = () => document.body.classList.toggle("noscroll", !!document.querySelector(".mdl:not([hidden]),.tv:not([hidden])"));
const tagCargo = (r) => el("span", r === "dono" ? "dono" : "rtag r-" + r, PAPEIS[r] || r);
const temCompra = (orders) => orders.some((o) => o.status === "concluido");

/* ============================ API pública ============================ */
export const Suporte = {
  init(h) { hooks = { ...hooks, ...h }; injetarCss(); ligar(); },
  // o app.js chama sempre que o usuário/cargo muda (renderNav)
  sync({ user, papel }) {
    const mudou = S.user?.uid !== user?.uid || S.papel !== papel;
    S.user = user; S.papel = papel; S.staff = !!papel;
    if (!user) return this.reset();
    if (mudou && S.isOpen) { escutar(); visual(); }
  },
  abrir(selecionar = null) {
    if (!S.user) return;
    S.focoAntes = document.activeElement; // devolve o foco aqui quando o painel fechar
    S.isOpen = true; S.selecionar = selecionar; S.cur = null; S.busca = ""; S.filtro = "todos";
    $("#spSearch").value = ""; $("#supportView").hidden = false; $("#supportView").classList.remove("open", "ctx-open");
    trava(); visual(); escutar(); renderCur();
    $("#spBack").focus(); // quem só usa teclado já entra com o foco dentro do painel
  },
  fechar() { desligar(); S.isOpen = false; S.cur = null; resetUpload(); $("#supportView").hidden = true; trava(); S.focoAntes?.focus(); S.focoAntes = null; },
  reset() { this.fechar(); S.lista = []; S.orders = []; S.ctxOrders = []; $("#spModal").hidden = true; trava(); },
};

function desligar() { ["uList", "uOrd", "uMsg", "uCtx"].forEach((k) => { S[k]?.(); S[k] = null; }); }

function escutar() {
  desligar(); S.erro = "";
  const u = S.user; if (!u) return;
  const q = S.staff ? query(collection(db, "suporte"), orderBy("updatedAt", "desc")) : query(collection(db, "suporte"), where("uid", "==", u.uid));
  S.uList = onSnapshot(q, (s) => {
    S.erro = "";
    S.lista = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.status === "resolvido") - (b.status === "resolvido") || ms(b.updatedAt) - ms(a.updatedAt));
    if (S.selecionar) { const t = S.lista.find((x) => x.id === S.selecionar); if (t) { S.selecionar = null; return pick(t); } }
    if (S.cur) { const novo = S.lista.find((x) => x.id === S.cur.id); if (novo) { const trocouCli = novo.uid !== S.cur.uid; S.cur = novo; if (trocouCli) escutarCtx(); } }
    renderLista(); renderCur();
  }, (e) => {
    console.error(e);
    S.erro = e.code === "permission-denied" ? "Sem permissão. Publique o novo firestore.rules no Firebase (regras da coleção “suporte”)." : "Não foi possível carregar os chamados.";
    renderLista();
  });
  // pedidos do próprio usuário (para vincular ao chamado)
  S.uOrd = ouvirTickets(u, false, (l) => { S.orders = l.sort((a, b) => ms(b.createdAt) - ms(a.createdAt)); renderPedidoSelect(); if (S.cur && !S.staff) renderCur(); });
}

// equipe: pedidos do CLIENTE do chamado aberto (histórico de compras ao vivo)
function escutarCtx() {
  S.uCtx?.(); S.uCtx = null; S.ctxOrders = [];
  if (!S.staff || !S.cur?.uid) return renderCtx();
  S.uCtx = onSnapshot(query(collection(db, "tickets"), where("uid", "==", S.cur.uid)),
    (s) => { S.ctxOrders = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt)); renderCtx(); renderCur(); },
    (e) => { console.warn("[suporte] histórico:", e); renderCtx(); });
}

function visual() {
  const v = $("#supportView");
  v.classList.toggle("staff", S.staff);
  $("#spTitle").textContent = S.staff ? "Central de Atendimento" : "Central de Suporte";
  $("#spMe").textContent = S.user ? meuNome() : "";
  renderLista();
}

/* ============================ lista ============================ */
const pedidoDe = (t) => (S.staff ? S.ctxOrders : S.orders).find((o) => o.id === t?.pedidoId) || null;
function alvoBusca(t) { return norm([t.assunto, t.userName, t.userEmail, proto(t.id), t.id, CATS[t.categoria], t.pedidoNome, STS[t.status], t.assumidoPor].join(" ")); }
function visiveis() {
  const ts = norm(S.busca).split(/\s+/).filter(Boolean);
  const base = S.lista.filter((t) => ts.every((x) => alvoBusca(t).includes(x)));
  return { base, lista: S.filtro === "todos" ? base : S.filtro === "meus" ? base.filter((t) => t.assumidoUid === S.user?.uid && t.status !== "resolvido") : base.filter((t) => t.status === S.filtro) };
}
function renderFiltros(base) {
  const box = $("#spFilters"); box.replaceChildren();
  const fs = S.staff ? [...FILTROS, ["meus", "Meus atendimentos"]] : FILTROS;
  fs.forEach(([f, nome]) => {
    const n = f === "todos" ? base.length : f === "meus" ? base.filter((t) => t.assumidoUid === S.user?.uid && t.status !== "resolvido").length : base.filter((t) => t.status === f).length;
    const b = el("button", "sp-chip" + (S.filtro === f ? " on" : "")); b.type = "button"; b.dataset.f = f;
    b.append(el("span", "", nome), el("b", "", String(n)));
    b.onclick = () => { S.filtro = f; renderLista(); };
    box.append(b);
  });
  $("#spSearchX").hidden = !S.busca;
}
function renderLista() {
  if (!S.isOpen) return;
  const { base, lista } = visiveis(); renderFiltros(base);
  const box = $("#spList"); box.replaceChildren();
  if (S.erro) { box.append(el("p", "empty sp-err", S.erro)); return; }
  if (!S.lista.length) { box.append(vazio(S.staff ? "Nenhum chamado de suporte ainda." : "Você ainda não abriu nenhum chamado.", S.staff ? "" : "Precisa de ajuda? Abra um chamado e a equipe responde por aqui.")); return; }
  if (!lista.length) { box.append(el("p", "empty", S.busca ? `Nada encontrado para “${S.busca.trim()}”.` : "Nenhum chamado neste filtro.")); return; }
  lista.forEach((t) => {
    const b = el("button", "sp-i" + (S.cur?.id === t.id ? " on" : "") + (t.status === "resolvido" ? " done" : "")); b.type = "button";
    const l1 = el("div", "sp-l1"); l1.append(el("span", "sp-t", t.assunto || "(sem assunto)"), chipSt(t.status));
    const l2 = el("div", "sp-l2");
    l2.append(el("span", "", S.staff ? (t.userName || "Cliente") : (CATS[t.categoria] || "Suporte")));
    if (S.staff) l2.append(el("span", "sp-dot", "•"), el("span", "", CATS[t.categoria] || "Suporte"));
    const tags = el("div", "sp-tags");
    tags.append(el("span", "sp-id", proto(t.id)));
    if (S.staff && t.prioridade === "alta" && t.status !== "resolvido") tags.append(el("span", "sp-pr", "▲ Prioridade"));
    if (t.pedidoId) tags.append(el("span", "sp-ped", "Pedido " + pedId(t.pedidoId)));
    if (S.staff) tags.append(el("span", "sp-who" + (t.assumidoUid ? "" : " vazio"), t.assumidoUid ? "👤 " + (t.assumidoPor || "Atendente") : "Sem responsável"));
    const ft = el("div", "sp-ft", fmt(t.updatedAt));
    b.append(l1, l2, tags, ft); b.onclick = () => pick(t); box.append(b);
  });
}
function vazio(a, b) { const d = el("div", "sp-empty"); d.append(el("b", "", a)); if (b) d.append(el("span", "", b)); return d; }

/* ============================ chamado aberto ============================ */
function pick(t) {
  if (S.cur?.id !== t.id) resetUpload();
  S.cur = t; S.msgs = []; $("#supportView").classList.add("open"); $("#supportView").classList.remove("ctx-open");
  S.uMsg?.(); S.uMsg = ouvirMensagens(t.id, renderMsgs, "suporte");
  escutarCtx(); renderLista(); renderCur();
}

function estadoVazio() {
  S.msgs = []; if (S.uMsg) { S.uMsg(); S.uMsg = null; }   // sem chamado aberto não fica ouvindo mensagens de chamado antigo
  $("#spBox").replaceChildren();
  const total = S.lista.length, abertos = S.lista.filter((x) => x.status === "aberto").length;
  $("#spEsT").textContent = S.staff ? "Central de Atendimento" : "Como podemos ajudar?";
  $("#spEsP").textContent = S.staff ? "Escolha um chamado na lista ao lado para atender, ou abra um novo." : "Selecione um chamado na lista ao lado ou abra um novo. A equipe responde por aqui mesmo.";
  const info = S.erro ? "" : S.staff
    ? (abertos ? `${abertos} chamado${abertos > 1 ? "s" : ""} aguardando atendimento` : total ? "Nenhum chamado aguardando atendimento" : "Nenhum chamado por enquanto")
    : (total ? `Você tem ${total} chamado${total > 1 ? "s" : ""}` : "Você ainda não abriu nenhum chamado");
  const i = $("#spEsInfo"); i.textContent = info; i.hidden = !info;
}
function renderCur() {
  if (!S.isOpen) return;
  const t = S.cur, v = $("#supportView");
  v.classList.toggle("has-cur", !!t);
  if (!t) estadoVazio();
  $("#spTitleCh").textContent = t ? t.assunto : "Selecione um chamado";
  $("#spSub").textContent = t ? [proto(t.id), CATS[t.categoria], S.staff ? t.userName : null].filter(Boolean).join(" · ") : "";
  const s = $("#spStatus"); s.replaceChildren(); if (t) s.append(chipSt(t.status));
  $("#spBox").classList.toggle("vazio", !t);

  // ferramentas
  const tools = $("#spTools2"); tools.replaceChildren();
  if (t && S.staff) {
    if (!t.assumidoUid) { const a = el("button", "tbtn on", "Assumir atendimento"); a.type = "button"; a.onclick = () => mudarStatus(t.status === "aberto" ? "em_andamento" : t.status, true); tools.append(a); }
    const sel = el("select", "sp-sel"); sel.setAttribute("aria-label", "Status do chamado");
    Object.entries(STS).forEach(([k, v2]) => { const o = el("option", "", v2); o.value = k; sel.append(o); });
    sel.value = t.status; sel.onchange = () => mudarStatus(sel.value); tools.append(sel);
    const c = el("button", "tbtn sp-ctxbtn", "Cliente"); c.type = "button"; c.onclick = () => v.classList.toggle("ctx-open"); tools.append(c);
  } else if (t) {
    if (t.status === "resolvido") { const r = el("button", "tbtn on", "Reabrir chamado"); r.type = "button"; r.onclick = () => mudarStatus(t.assumidoUid ? "em_andamento" : "aberto"); tools.append(r); }
    else { const r = el("button", "tbtn ok", "✓ Marcar como resolvido"); r.type = "button"; r.onclick = () => { if (confirm("Seu problema foi resolvido? O chamado será encerrado (você pode reabrir depois).")) mudarStatus("resolvido"); }; tools.append(r); }
  }
  tools.hidden = !t;

  // pedido vinculado (faixa no topo do chat)
  const ob = $("#spOrder"); ob.replaceChildren(); ob.hidden = true;
  if (t?.pedidoId) {
    ob.hidden = false; const p = pedidoDe(t);
    const ic = el("span", "sp-o-ic"); ic.innerHTML = '<svg class="ic"><use href="#i-ticket"/></svg>';
    const info = el("div", "sp-o-i");
    info.append(el("small", "", "PEDIDO VINCULADO"), el("b", "", p ? p.productName : (t.pedidoNome || "Pedido")),
      el("span", "", p ? `${brl(p.price)} · ${fmt(p.createdAt)} · ${pedId(p.id)}` : pedId(t.pedidoId)));
    ob.append(ic, info);
    if (p) ob.append(el("span", "stt " + p.status, ORD[p.status] || p.status));
    const bt = el("button", "tbtn", "Ver pedido"); bt.type = "button"; bt.onclick = () => hooks.abrirPedido(t.pedidoId, S.staff); ob.append(bt);
  }

  // formulário: cliente não escreve em chamado resolvido (precisa reabrir)
  const fechado = !S.staff && t?.status === "resolvido";
  $("#spForm").hidden = !t || fechado;
  $("#spMacroWrap").hidden = !S.staff;
  $("#spClosedNote").hidden = !fechado;
  renderCtx();
}

/* ---------- painel do cliente (equipe) ---------- */
function renderCtx() {
  const box = $("#spCtx"); box.replaceChildren();
  const t = S.cur; box.hidden = !(S.staff && t); if (!S.staff || !t) return;
  const orders = S.ctxOrders, comprou = temCompra(orders);
  const gasto = orders.filter((o) => o.status === "concluido").reduce((a, o) => a + (Number(o.price) || 0), 0);
  const anteriores = S.lista.filter((x) => x.uid === t.uid && x.id !== t.id);
  const x = el("button", "sp-ctx-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Fechar painel"); x.onclick = () => $("#supportView").classList.remove("ctx-open");

  // cabeçalho do cliente
  const head = el("div", "sp-cl"), av = el("div", "tk-av");
  if (t.userPhoto && /^https:\/\//.test(t.userPhoto)) { const i = el("img"); i.alt = ""; i.referrerPolicy = "no-referrer"; i.src = t.userPhoto; av.append(i); } else av.textContent = (t.userName || "?")[0].toUpperCase();
  const nm = el("div", "sp-cl-n"); nm.append(el("b", "", t.userName || "Cliente"), el("small", "", t.userEmail || "sem e-mail"));
  head.append(av, nm);
  const tg = el("div", "sp-tags"); tg.append(el("span", "rtag " + (comprou ? "comprador" : "visitante"), comprou ? "COMPRADOR" : "FUTURO COMPRADOR"));
  if (t.discordId) tg.append(el("span", "sp-ped", "Discord · " + t.discordId));

  // números
  const kpi = el("div", "sp-kpi");
  [[String(orders.filter((o) => o.status === "concluido").length), "Compras"], [brl(gasto), "Total gasto"], [String(anteriores.length), "Chamados antes"]].forEach(([v, k]) => { const d = el("div"); d.append(el("b", "", v), el("span", "", k)); kpi.append(d); });

  // detalhes do chamado
  const det = el("div", "sp-kv");
  [["Protocolo", proto(t.id)], ["Categoria", CATS[t.categoria] || "—"], ["Prioridade", t.prioridade === "alta" ? "Alta" : "Normal"], ["Aberto em", fmt(t.createdAt)],
    ["Responsável", t.assumidoPor || "Ninguém ainda"], ...(t.status === "resolvido" ? [["Resolvido em", fmt(t.resolvedAt)]] : [])]
    .forEach(([k, v]) => { const r = el("div"); r.append(el("span", "", k), el("b", "", v)); det.append(r); });

  box.append(x, secao("Cliente", head, tg, kpi), secao("Detalhes do chamado", det));

  // pedido vinculado + histórico de compras
  const vinc = t.pedidoId ? orders.find((o) => o.id === t.pedidoId) : null;
  if (t.pedidoId) box.append(secao("Pedido vinculado", vinc ? linhaPedido(vinc, true) : el("p", "sp-mut", "Pedido " + pedId(t.pedidoId) + " (não encontrado ou removido).")));
  const hist = el("div", "sp-lista");
  if (!orders.length) hist.append(el("p", "sp-mut", "Este cliente ainda não abriu nenhum pedido."));
  orders.forEach((o) => { if (o.id !== t.pedidoId) hist.append(linhaPedido(o)); });
  box.append(secao("Histórico de compras (" + orders.length + ")", hist));

  // chamados anteriores
  const ant = el("div", "sp-lista");
  if (!anteriores.length) ant.append(el("p", "sp-mut", "Primeiro chamado deste cliente."));
  anteriores.slice(0, 6).forEach((a) => {
    const b = el("button", "sp-row"); b.type = "button";
    const l = el("div", "sp-row-i"); l.append(el("b", "", a.assunto), el("small", "", `${proto(a.id)} · ${fmt(a.createdAt)}`));
    b.append(l, chipSt(a.status)); b.onclick = () => pick(a); ant.append(b);
  });
  box.append(secao("Chamados anteriores", ant));
}
function secao(titulo, ...filhos) { const s = el("section", "sp-sec"); s.append(el("h4", "", titulo), ...filhos); return s; }
function linhaPedido(o, destaque) {
  const b = el("button", "sp-ord" + (destaque ? " hl" : "")); b.type = "button";
  const meta = el("div", "sp-ord-m"); meta.append(el("span", "", fmt(o.createdAt)), el("span", "", pedId(o.id)));
  b.append(el("b", "sp-ord-n", o.productName || "Pedido"), el("span", "sp-ord-v", brl(o.price)), el("span", "stt " + o.status, ORD[o.status] || o.status), meta);
  b.title = "Abrir o ticket deste pedido"; b.onclick = () => hooks.abrirPedido(o.id, true); return b;
}

/* ============================ mensagens ============================ */
function renderMsgs(list) {
  S.msgs = list;
  const box = $("#spBox"); box.replaceChildren(); box.classList.remove("vazio");
  let dia = null;
  list.forEach((m) => {
    const d = m.createdAt?.toDate?.() ?? new Date();
    if (d.toDateString() !== dia) { dia = d.toDateString(); box.append(el("div", "dsep", rotuloDia(d))); }
    if (m.sys) { const s = el("div", "sp-sys"); s.append(el("span", "", m.text), el("time", "", horaDe(m.createdAt))); box.append(s); return; }

    const mine = !!S.user && m.uid === S.user.uid;
    const rol = m.isAdmin ? (m.role === "vendedor" || m.role === "suporte" ? m.role : "dono") : null;
    const row = el("div", "msg " + (m.isAdmin ? "adm" : "cli") + (rol && rol !== "dono" ? " r-" + rol : "") + (mine ? " mine" : ""));
    const nome = mine ? meuNome() : m.name, foto = mine ? (S.user.photoURL || "") : m.photo;
    const av = el("div", "mav");
    if (foto && /^https:\/\//.test(foto)) { const i = el("img"); i.src = foto; i.alt = ""; i.referrerPolicy = "no-referrer"; av.append(i); } else av.textContent = (nome || "?")[0].toUpperCase();
    const col = el("div", "mcol"), nm = el("div", "mname");
    if (rol === "dono") { const c = el("span", "crown"); c.innerHTML = '<svg viewBox="0 0 100 80"><use href="#cr"/></svg>'; nm.append(c); }
    nm.append(el("span", "", nome || "?"));
    if (rol) nm.append(tagCargo(rol));
    const bub = el("div", "bub");
    if (m.text) { const p = el("div", "mt"); linkify(p, m.text); bub.append(p); }
    if (m.fileUrl && /^https:\/\//.test(m.fileUrl)) {
      if ((m.fileType || "").startsWith("image/")) {
        const a = el("a"); a.href = m.fileUrl; a.target = "_blank"; a.rel = "noopener";
        const i = el("img", "mimg"); i.src = m.fileUrl; i.alt = m.fileName || ""; i.loading = "lazy"; i.onload = () => { box.scrollTop = box.scrollHeight; }; a.append(i); bub.append(a);
      } else {
        const a = el("a", "mfile"); a.href = m.fileUrl; a.rel = "noopener"; a.setAttribute("download", m.fileName || "arquivo");
        const ico = el("span", "mf-ico"); ico.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>';
        const info = el("span", "mf-info"); info.append(el("span", "mf-name", m.fileName || "arquivo"), el("small", "mf-sub", "Clique para baixar" + (m.fileSize ? " · " + fmtBytes(m.fileSize) : "")));
        a.append(ico, info, el("span", "mf-cta", "BAIXAR")); bub.append(a);
      }
    }
    const tm = el("time", "mtime", horaDe(m.createdAt)); tm.title = d.toLocaleString("pt-BR"); bub.append(tm);
    col.append(nm, bub); row.append(av, col); box.append(row);
  });
  box.scrollTop = box.scrollHeight;
}
function linkify(p, text) {
  text.split(/((?:https?:\/\/|www\.)[^\s<]+)/g).forEach((s, i) => {
    if (!(i % 2)) { p.append(s); return; }
    const fim = s.match(/[.,;:!?)\]]+$/)?.[0] ?? "", url = fim ? s.slice(0, -fim.length) : s;
    const a = el("a", "", url); a.href = /^www\./i.test(url) ? "https://" + url : url; a.target = "_blank"; a.rel = "noopener noreferrer"; p.append(a, fim);
  });
}

/* ============================ status ============================ */
async function evento(texto) { // linha de "linha do tempo" no chat (ex.: "Fulano assumiu o atendimento")
  const t = S.cur; if (!t) return;
  await addDoc(collection(db, "suporte", t.id, "messages"), {
    uid: S.user.uid, name: meuNome(), photo: S.user.photoURL || "", isAdmin: S.staff, role: S.staff ? S.papel : "cliente",
    text: texto, sys: true, fileUrl: null, fileName: null, fileType: null, fileSize: null, createdAt: serverTimestamp(),
  }).catch((e) => console.warn(e));
}
async function mudarStatus(novo, assumir = false) {
  const t = S.cur; if (!t || (t.status === novo && !assumir)) return;
  const antigo = t.status, d = { status: novo, updatedAt: serverTimestamp() };
  if (novo === "resolvido") d.resolvedAt = serverTimestamp(); else if (antigo === "resolvido") d.resolvedAt = null;
  if (S.staff && !t.assumidoUid && (assumir || novo !== "aberto")) { d.assumidoUid = S.user.uid; d.assumidoPor = meuNome(); }
  try {
    await updateDoc(doc(db, "suporte", t.id), d);
    atualizarAvisoSuporte(t.id);   // edita a mensagem do chamado no Discord (status / responsável / resolvido)
    if (S.staff) registrarAuditoria("suporte", "status", { alvo: t.id, detalhe: `${t.assunto || ""}: ${antigo} → ${novo}` }, S.user, S.papel);
    const quem = meuNome();
    if (assumir && !t.assumidoUid && novo === antigo) await evento(`${quem} assumiu o atendimento.`);
    else if (novo === "resolvido") await evento(`${quem} marcou o chamado como resolvido.`);
    else if (antigo === "resolvido") await evento(`${quem} reabriu o chamado.`);
    else await evento(`${quem} alterou o status para “${STS[novo]}”.`);
  } catch (e) { console.error(e); alert(e.code === "permission-denied" ? "Sem permissão para alterar o chamado. Publique o novo firestore.rules." : "Não foi possível alterar o status."); renderCur(); }
}

/* ============================ novo chamado (modal) ============================ */
function renderPedidoSelect() {
  const sel = $("#spPed"); if (!sel) return; const atual = sel.value; sel.replaceChildren();
  const o0 = el("option", "", "Nenhum pedido (dúvida geral)"); o0.value = ""; sel.append(o0);
  S.orders.forEach((o) => { const o1 = el("option", "", `${o.productName} · ${brl(o.price)} · ${ORD[o.status] || o.status} · ${pedId(o.id)}`); o1.value = o.id; sel.append(o1); });
  sel.value = S.orders.some((o) => o.id === atual) ? atual : "";
}
function abrirModal() {
  if (!S.user) return;
  $("#spCat").selectedIndex = 0; $("#spAssunto").value = ""; $("#spDesc").value = ""; $("#spModalErr").textContent = ""; renderPedidoSelect();
  $("#spCount").textContent = "0/1000"; $("#spCreate").disabled = false; $("#spCreate").textContent = "Abrir chamado";
  $("#spModal").hidden = false; trava(); setTimeout(() => $("#spAssunto").focus(), 50);
}
async function criar() {
  const btn = $("#spCreate"), err = $("#spModalErr"); err.textContent = "";
  const cat = $("#spCat").value, assunto = $("#spAssunto").value.trim(), desc = $("#spDesc").value.trim(), pid = $("#spPed").value;
  if (!CATS[cat]) return void (err.textContent = "Escolha uma categoria.");
  if (assunto.length < 3) return void (err.textContent = "Escreva um assunto (mínimo 3 letras).");
  if (desc.length < 10) return void (err.textContent = "Descreva o problema com mais detalhes (mínimo 10 letras).");
  if (S.lista.filter((t) => t.uid === S.user.uid && t.status !== "resolvido").length >= 5) return void (err.textContent = "Você já tem 5 chamados em aberto. Aguarde a equipe ou marque algum como resolvido.");
  const u = S.user, ped = S.orders.find((o) => o.id === pid) || null;
  btn.disabled = true; btn.textContent = "Abrindo…";
  try {
    const ref = await addDoc(collection(db, "suporte"), {
      uid: u.uid, userName: meuNome(), userEmail: u.email || "", userPhoto: u.photoURL || "", discordId: discordIdDe(u) || null,
      assunto: assunto.slice(0, 120), categoria: cat, prioridade: cat === "acesso" || cat === "pagamento" ? "alta" : "normal",
      pedidoId: ped ? ped.id : null, pedidoNome: ped ? ped.productName : null,
      status: "aberto", assumidoPor: null, assumidoUid: null, resolvedAt: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    const texto = `📋 ${CATS[cat]}` + (ped ? `\n🧾 Pedido: ${ped.productName} (${pedId(ped.id)})` : "") + `\n\n${desc}`;
    await enviarMensagem(ref.id, u, { text: texto, colecao: "suporte" }, false);
    avisarSuporteNovo(ref.id);
    $("#spModal").hidden = true; trava();
    if (!S.isOpen) Suporte.abrir(ref.id); else { S.selecionar = ref.id; }
  } catch (e) {
    console.error(e);
    err.textContent = e.code === "permission-denied" ? "Sem permissão. Publique o novo firestore.rules no Firebase." : (e.message || "Não foi possível abrir o chamado.");
    btn.disabled = false; btn.textContent = "Abrir chamado";
  }
}

/* ============================ envio (texto + anexo) ============================ */
function uplEstado(cls, meta) { $("#spUpl").className = "upl" + (cls ? " " + cls : ""); if (meta != null) $("#spUplMeta").textContent = meta; }
const uplBarra = (f) => { $("#spUplFill").style.width = Math.round(f * 100) + "%"; };
function ocupado(on) {
  $("#spForm").classList.toggle("busy", on);
  ["#spSend", "#spText", "#spFile", "#spMacro"].forEach((s) => { const x = $(s); if (x) x.disabled = on; });
  $("#spSend").textContent = on ? "Enviando…" : "Enviar";
}
function resetUpload() {
  try { U.task?.cancel(); } catch {}
  U.task = null; U.file = null; U.busy = false;
  if (U.thumb) { URL.revokeObjectURL(U.thumb); U.thumb = null; }
  const f = $("#spFile"); if (f) f.value = "";
  if ($("#spUpl")) { $("#spUpl").hidden = true; $("#spUplThumb").hidden = true; $("#spUplIc").hidden = false; uplBarra(0); uplEstado("", ""); }
  if ($("#spUplErr")) $("#spUplErr").textContent = ""; if ($("#spSend")) ocupado(false);
}
async function enviar(e) {
  e.preventDefault();
  const t = S.cur, f = U.file, text = $("#spText").value.trim();
  if (U.busy || !t || (!text && !f)) return;
  U.busy = true; ocupado(true); $("#spUplErr").textContent = "";
  if (f) { uplBarra(0); uplEstado("sending", "Enviando… 0%"); }
  try {
    await enviarMensagem(t.id, S.user, {
      text, file: f, role: S.papel, colecao: "suporte", onTask: (k) => (U.task = k),
      onProgress: ({ pct, sent, total }) => { uplBarra(pct); uplEstado("sending", `Enviando… ${Math.round(pct * 100)}% · ${fmtBytes(sent)} de ${fmtBytes(total)}`); },
    }, S.staff);
    if (f) { uplBarra(1); uplEstado("done", "Enviado ✓"); await new Promise((r) => setTimeout(r, 700)); }
    // fluxo automático: equipe respondeu -> "aguardando cliente" | cliente respondeu -> "em atendimento"
    let novo = null; const d = {};
    if (S.staff && (t.status === "aberto" || t.status === "em_andamento")) novo = "aguardando_cliente";
    else if (!S.staff && t.status === "aguardando_cliente") novo = "em_andamento";
    if (S.staff && !t.assumidoUid) { d.assumidoUid = S.user.uid; d.assumidoPor = meuNome(); }
    if (novo || d.assumidoUid) updateDoc(doc(db, "suporte", t.id), { ...(novo ? { status: novo } : {}), ...d, updatedAt: serverTimestamp() }).then(() => atualizarAvisoSuporte(t.id)).catch((x) => console.warn(x));
    $("#spText").value = ""; $("#spMacro").selectedIndex = 0; resetUpload();
  } catch (err) {
    if (err.code === "storage/canceled") return;
    console.error(err); $("#spUplErr").textContent = err.message || "Não foi possível enviar.";
    if (f) uplEstado("err", "Falhou. Clique em Enviar para tentar de novo.");
  } finally { U.busy = false; U.task = null; ocupado(false); }
}

/* ============================ ligações de eventos (uma vez) ============================ */
let ligado = false;
function ligar() {
  if (ligado) return; ligado = true;
  $("#spBack").onclick = () => Suporte.fechar();
  $("#spChBack").onclick = () => $("#supportView").classList.remove("open", "ctx-open");
  $("#spNew").onclick = abrirModal;
  const es = el("div", "sp-es"); es.id = "spEmptyState";
  const esIc = el("span", "sp-es-ic"); esIc.innerHTML = '<svg class="ic"><use href="#i-ticket"/></svg>';
  const esT = el("h3"); esT.id = "spEsT"; const esP = el("p"); esP.id = "spEsP";
  const esI = el("span", "sp-es-info"); esI.id = "spEsInfo";
  const esB = el("button", "btn g sp-es-btn", "+ Novo chamado"); esB.type = "button"; esB.onclick = abrirModal;
  es.append(esIc, esT, esP, esI, esB); $("#supportView .tv-chat").append(es);
  $("#spCreate").onclick = criar;
  $("#spDesc").addEventListener("input", (e) => { $("#spCount").textContent = e.target.value.length + "/1000"; });
  $("#spSearch").addEventListener("input", (e) => { S.busca = e.target.value; renderLista(); });
  $("#spSearch").addEventListener("keydown", (e) => { if (e.key === "Escape" && S.busca) { e.stopPropagation(); limpar(); } });
  $("#spSearchX").onclick = limpar;
  function limpar() { S.busca = ""; $("#spSearch").value = ""; renderLista(); $("#spSearch").focus(); }

  $("#spFile").accept = ARQUIVOS_ACEITOS;
  $("#spUplX").onclick = resetUpload;
  $("#spFile").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const problema = validarArquivo(f);
    if (problema) { resetUpload(); $("#spUplErr").textContent = problema; return; }
    if (U.thumb) { URL.revokeObjectURL(U.thumb); U.thumb = null; }
    U.file = f; $("#spUplErr").textContent = "";
    const img = f.type.startsWith("image/");
    if (img) { U.thumb = URL.createObjectURL(f); $("#spUplThumb").src = U.thumb; }
    $("#spUplThumb").hidden = !img; $("#spUplIc").hidden = img;
    $("#spUplName").textContent = f.name; uplBarra(0); uplEstado("", fmtBytes(f.size) + " · pronto para enviar"); $("#spUpl").hidden = false;
  };
  $("#spForm").onsubmit = enviar;

  const m = $("#spMacro"); m.replaceChildren();
  const o0 = el("option", "", "⚡ Resposta rápida"); o0.value = ""; m.append(o0);
  MACROS.forEach(([k, v]) => { const o = el("option", "", k); o.value = v; m.append(o); });
  m.onchange = () => { if (!m.value) return; $("#spText").value = m.value; $("#spText").focus(); };
}