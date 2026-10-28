<div align="center">

<img src="https://nx7painel.netlify.app/nx7-preview.png" alt="Nx7 Banner" width="600" style="border-radius: 20px;" />

# 👑 Nx7 — Scripts Exclusivos para Discord

**Eleve sua experiência no Discord ao próximo nível.**  
Automação, limpeza e gerenciamento de contas com interface premium, tickets privados, central de suporte e painel de controle.

[![Netlify Status](https://api.netlify.com/api/v1/badges/SEU-SITE-ID/deploy-status)](https://app.netlify.com/sites/nx7painel/deploys)
[![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)](https://firebase.google.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)]()
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)]()
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()

</div>

---

## 📑 Sumário

- [Sobre o projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Cargos e permissões](#-cargos-e-permissões)
- [Tecnologias e serviços](#️-tecnologias-e-serviços)
- [Arquitetura](#-arquitetura)
- [Estrutura do repositório](#-estrutura-do-repositório)
- [Configuração](#️-configuração)
- [Publicação](#-publicação)
- [Segurança](#-segurança)

---

## 🚀 Sobre o projeto

A **Nx7** é uma loja web (SPA) feita para vender scripts de automação para o Discord. O site tem design moderno (modo escuro, roxo neon e elementos 3D), login multiplataforma, tickets privados com chat em tempo real, central de suporte e um **Console** de gestão exclusivo do dono.

O foco é uma experiência de compra **rápida, segura e premium**, com o vendedor conectado diretamente ao cliente por tickets privados.

---

## ✨ Funcionalidades

### 👤 Para o cliente
- 🔐 **Login integrado:** Google, Discord ou e-mail e senha (Firebase Auth).
- 🛒 **Loja:** produtos Solo e Combo, com confirmação de pedido antes de abrir o ticket.
- 🎫 **Meus tickets:** chat privado em tempo real com o vendedor.
- 📎 **Anexos:** envio de prints, links e arquivos `.zip`, `.rar` e `.7z` pelo chat.
- 🆘 **Central de suporte:** abertura de chamados por categoria e prioridade, com acompanhamento do status.
- 🙍 **Meu perfil:** troca de nome e foto, e exclusão da conta com todos os dados (LGPD).
- 🎨 **Design premium:** interface responsiva com animações (GSAP).

### 🛡️ Para a equipe e o dono
- 💬 **Atendimento em tempo real:** responder tickets e chamados, enviar arquivos e links.
- ✅ **Status do pedido:** Pendente, Concluído ou Reembolsado.
- 💸 **Reembolso:** registro com motivo, observação e comprovante opcional.
- 🎧 **Chamados de suporte:** Aberto, Em atendimento, Aguardando cliente e Resolvido.
- 👥 **Gestão da equipe:** adicionar, trocar o cargo ou remover membros (só o dono).
- 🏷️ **Cargos no Discord:** vendedor, suporte e comprador aplicados automaticamente no servidor.

### ⚡ Console Nx7 (só o dono)
| Página | O que mostra |
| :--- | :--- |
| **Visão geral** | Receita, reembolsos, chamados abertos, tamanho da equipe, status dos serviços e últimas ações |
| **Status dos serviços** | Firestore, avisos de venda, cargos, logs, Supabase e Cloudinary |
| **Vendas** | Gráfico de pedidos por status |
| **Suporte** | Gráfico de chamados por status |
| **Equipe** | Gráfico de membros por cargo |
| **Auditoria** | Log filtrável de vendas, reembolsos, cargos e suporte |

### 🔔 Avisos automáticos no Discord
- Venda nova (canal de vendas).
- Chamado de suporte novo, com a mesma mensagem editada conforme o status.
- Cargo adicionado, alterado ou removido (canal de log de cargos).

---

## 🔑 Cargos e permissões

| Ação | Dono | Vendedor | Suporte |
| :--- | :---: | :---: | :---: |
| Ver e responder tickets | ✅ | ✅ | ✅ |
| Marcar Pendente / Concluído | ✅ | conforme `PERMS` | conforme `PERMS` |
| Fazer reembolsos | ✅ | conforme `PERMS` | conforme `PERMS` |
| Gerenciar a equipe | ✅ | ❌ | ❌ |
| Console Nx7 e auditoria | ✅ | ❌ | ❌ |

> As permissões de status, reembolso e equipe vêm da tabela `PERMS` no `app.js`; mudou lá, muda no site. O painel da equipe mostra a tabela atual.

---

## 🛠️ Tecnologias e serviços

| Camada | Tecnologia | Função |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript puro | Interface, animações e SPA |
| **Animações** | GSAP, CSS Grid/Flex | Movimento, responsividade e efeitos 3D |
| **Banco e login** | Firebase v10 (Auth + Firestore) | Contas, tickets, chamados, equipe e auditoria |
| **Fotos de perfil** | Cloudinary (upload *unsigned*) | Armazenar avatares |
| **Anexos dos tickets** | Supabase Storage | Armazenar `.zip`, `.rar`, `.7z` e imagens |
| **Login com Discord** | Firebase Auth (OpenID Connect `oidc.discord`) | O próprio Firebase cuida do OAuth, incluindo o `state` anti-CSRF |
| **Integração com Discord** | Cloudflare Workers | Avisos de venda, cargos no servidor e logs |
| **Hospedagem** | Netlify | Deploy e funções serverless |
| **Fontes** | Google Fonts | Orbitron e Inter |

---

## 🧭 Arquitetura

```text
Navegador (index.html + js/ + css/)
   │
   ├── Firebase Auth / Firestore ........ login, tickets, chamados, equipe, auditoria
   ├── Cloudinary ....................... fotos de perfil
   ├── Supabase Storage ................. anexos dos tickets
   └── Cloudflare Workers
         ├── notify-discord ............. aviso de venda
         ├── discord-roles .............. cargos no servidor (usa o bot)
         └── discord-logs ............... chamados de suporte e log de cargos
```

Os Workers recebem o `idToken` do Firebase, conferem quem chamou e leem o documento no Firestore com o token do próprio usuário, então as regras de segurança continuam valendo.

---

## 📁 Estrutura do repositório

```text
📁 Site Nx7 Loja/
│
├── 📄 index.html            # Landing page, loja e modais
├── 📄 nx7-preview.png       # Imagem Open Graph (preview do link)
├── 📄 firestore.rules       # Regras de segurança do Firestore
├── 📄 _headers              # Cabeçalhos de segurança (CSP, HSTS, etc.) da Netlify
├── 📄 README.md
│
├── 📁 css/
│   ├── 📄 site.css          # Estilos do site e dos painéis
│   └── 📄 chat-v3.css       # Estilos antigos do chat
│
├── 📁 img/                  # Logos, favicon e imagens do site
│
├── 📁 js/
│   ├── 📄 app.js            # Lógica principal: login, loja, tickets, equipe, console
│   ├── 📄 db.js             # Firestore, uploads, Workers e status dos serviços
│   ├── 📄 support.js        # Central de suporte (chamados)
│   ├── 📄 ui.js             # Animações, menu e efeitos da página
│   ├── 📄 gsap.min.js       # GSAP 3.12.5 hospedado no próprio site (sem CDN)
│   └── 📄 firebase-config.js# Chaves públicas e URLs dos serviços
```

> Os arquivos dos Cloudflare Workers (`discord-roles-worker.js`, `discord-logs-worker.js` e o de avisos de venda) são publicados direto na Cloudflare e ficam fora desta pasta.

---

## ⚙️ Configuração

### 1. Firebase
1. Crie o projeto e ative **Authentication** (Google, e-mail e senha) e **Firestore**.
2. Copie as chaves do app web para `js/firebase-config.js`.
3. Em `ADMIN_EMAIL` (no `firebase-config.js`), use o **mesmo e-mail** que está no `firestore.rules`.
4. Publique o `firestore.rules` em *Firestore Database → Regras*.

### 2. Cloudinary (fotos de perfil)
Crie um *upload preset* com **Signing mode = Unsigned** e preencha `CLOUDINARY = { cloud, preset }`.

### 3. Supabase (anexos)
Crie um bucket **público** (`nx7-arquivos`), libere o envio com as políticas de Storage e preencha `SUPABASE = { url, key, bucket }` com a chave *anon / publishable*.

### 4. Cloudflare Workers
Cada Worker tem o passo a passo no topo do próprio arquivo. Resumo:

| Worker | Variáveis (Secrets / Text) | URL vai em |
| :--- | :--- | :--- |
| `notify-discord` | webhook do canal de vendas | `NOTIFY_DISCORD_URL` |
| `discord-roles` | token do bot e IDs dos cargos | `ROLES_URL` |
| `discord-logs` | `WEBHOOK_SUPORTE`, `WEBHOOK_CARGOS` (secrets); `SITE_URL`, `PING_SUPORTE_ROLE`, `ALLOWED_ORIGIN` (opcionais); KV `CHAMADOS` para editar a mensagem do chamado | `LOGS_URL` |

> Os links de webhook ficam **só como Secrets** no Worker. Nunca cole o link do webhook no site.

### 5. Login com Discord
No Firebase: *Authentication → Sign-in method → OpenID Connect*, com Provider ID `oidc.discord`. O OAuth (incluindo o `state`) é feito pelo Firebase; não há função no Netlify nem segredo do Discord no site.

### 6. Netlify (cabeçalhos)
Deixe o arquivo `_headers` na raiz do site. Se mudar de domínio ou adicionar um serviço novo (outro Worker, outro bucket), libere o endereço em `connect-src` / `img-src`.

---

## 🚀 Publicação

- **Netlify:** conecte o repositório ou arraste a pasta do projeto (o `_headers` precisa estar na raiz).
- **Teste local:** abra com o *Live Server* do VS Code. O login com Discord e os Workers podem recusar chamadas vindas de `127.0.0.1`; teste esses fluxos no site publicado.
- **Cache:** os arquivos do site são chamados com `?v=1` (`css/site.css?v=1`, `js/ui.js?v=1`). Ao mudar o CSS ou o JS, aumente o número para os visitantes receberem a versão nova.

---

## 🔒 Segurança

- As chaves do Firebase, do Cloudinary e do Supabase no front são públicas por natureza; a proteção real está no `firestore.rules`, no preset *unsigned* e nas políticas do bucket.
- O dono é identificado por **e-mail verificado**, igual no `firebase-config.js` e no `firestore.rules`.
- A equipe pode **criar** registros de auditoria, mas só o dono consegue **ler e apagar**.
- Segredos (webhooks e token do bot) ficam somente como Secrets da Cloudflare, nunca no código.
- O cargo de equipe por e-mail só vale com **e-mail verificado** (`firestore.rules`), para ninguém herdar um cargo criando conta com o e-mail de um membro.
- Preço e produto do pedido são validados nas regras; links de anexo só aceitos do bucket do Supabase.
- O `_headers` aplica CSP (só scripts do próprio site, do Firebase e do Google), anti-clickjacking, HSTS e Referrer-Policy.
- Revisão periódica: preset *Unsigned* do Cloudinary (formatos, tamanho máximo e pasta fixos) e políticas do bucket do Supabase (só `INSERT` no bucket `nx7-arquivos`, sem `UPDATE`/`DELETE`/`SELECT` para anônimos além do necessário).
- O Worker de logs só aceita avisos de cargo da equipe vindos do dono.

---

<div align="center">

Feito com 💜 por **Nx7** · © 2026 Nx7. Todos os direitos reservados.

</div>