<div align="center">

<!-- Substitua o link abaixo pela sua imagem local se preferir, ou deixe o link do Netlify -->
<img src="https://nx7painel.netlify.app/nx7-preview.png" alt="Nx7 Banner" width="600" style="border-radius: 20px;" />

# 👑 Nx7 — Scripts Exclusivos para Discord

**Eleve sua experiência no Discord ao próximo nível.**  
Automação, limpeza e gerenciamento de contas com uma interface premium, sistema de tickets e pagamentos.

[![Netlify Status](https://api.netlify.com/api/v1/badges/SEU-SITE-ID/deploy-status)](https://app.netlify.com/sites/nx7painel/deploys)
[![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)](https://firebase.google.com/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)]()
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)]()
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()

</div>

---

## 🚀 Sobre o Projeto

A **Nx7** é uma loja web completa (SPA) desenvolvida para vender scripts de automação para o Discord. O site conta com um design moderno (Dark Mode, Roxo Neon e elementos 3D), sistema de autenticação multiplataforma, chat em tempo real para suporte e um painel administrativo exclusivo.

O foco principal é entregar uma experiência de compra **rápida, segura e premium** para o usuário, mantendo o vendedor conectado diretamente com o cliente através de tickets privados.

## ✨ Funcionalidades

### Para o Cliente:
- 🔐 **Login Integrado:** Entre com Google, Discord ou E-mail (via Firebase Auth).
- 🛒 **Loja Integrada:** Visualização de produtos (Solo / Combo) e botão de compra direto.
- 🎫 **Meus Tickets:** Sistema de suporte privado com chat em tempo real.
- 📎 **Envio de Arquivos:** Envie prints, links e arquivos `.zip` diretamente pelo chat do ticket.
- 🎨 **Design Premium:** Interface responsiva com animações fluidas (GSAP) e efeitos de partículas.

### Para o Administrador (Você):
- 🛡️ **Acesso Restrito:** Painel admin protegido por e-mail (definido no Firebase).
- 📊 **Dashboard de Tickets:** Visualize todos os tickets abertos na loja.
- 💬 **Atendimento Real-time:** Responda clientes, envie arquivos `.zip` e links no chat.
- ✅ **Status do Pedido:** Marque tickets como "Pendente" ou "Concluído".

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia | Função |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JS Vanilla | Interface, animações e roteamento SPA |
| **Estilização** | GSAP, CSS Grid/Flex | Animações, responsividade e design 3D |
| **Backend (BaaS)** | Firebase (v10) | Autenticação, Firestore (Banco) e Storage (Arquivos) |
| **Hospedagem** | Netlify | Deploy contínuo e Netlify Functions (OAuth Discord) |
| **Fontes** | Google Fonts | Orbitron & Inter |

---

## 📁 Estrutura do Repositório

```text
📁 Site-Nx7/
│
├── 📄 index.html            # Página principal (Landing Page + Loja + Modais)
├── 📄 nx7-preview.png       # Imagem Open Graph (Preview do link)
├── 📄 firebase-config.js    # Configurações do Firebase (API Keys)
├── 📄 package.json          # Dependências e metadados do projeto
├── 📄 firestore.rules       # Regras de segurança do Banco de Dados
├── 📄 storage.rules         # Regras de segurança dos arquivos
│
├── 📁 js/
│   ├── 📄 app.js            # Lógica da UI, modais, eventos e SPA
│   └── 📄 db.js             # Funções do banco de dados (CRUD) e Storage
│
└── 📁 netlify/
    └── 📁 functions/
        └── 📄 discord-auth.js # Função serverless para login via Discord
```

☁️ Deploy e Configuração
O site foi arquitetado para rodar no Netlify. Para o funcionamento completo (incluindo o login do Discord), você precisará configurar:

1 - Firebase: Ativar Authentication (Google, Email/Senha, Discord), Firestore e Storage.

2 - Netlify: Conectar o repositório do GitHub.

3 - Discord Developer Portal: Criar um App, pegar o Client ID e Client Secret para colocar no Firebase e nas variáveis de ambiente do Netlify.

⚠️ Aviso Legal
Atenção: O uso de scripts em contas de usuário (Self-Bots) vai contra os Termos de Serviço do Discord e pode resultar no banimento da conta. Este projeto é vendido e distribuído para fins educacionais e de automação, e o uso é de inteira responsabilidade do comprador.

<div align="center"> <b>Desenvolvido com 💜 por <a href="https://github.com/NoxyRJ">Noxy7</a></b><br> <i>Entre em contato pelo nosso Discord para adquirir os scripts.</i> </div> ```
