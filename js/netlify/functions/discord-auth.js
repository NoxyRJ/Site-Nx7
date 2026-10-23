// Login com Discord -> token do Firebase (o Firebase não tem Discord nativo).
// Variáveis no Netlify: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, FIREBASE_SERVICE_ACCOUNT
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const json = (s, o) => ({ statusCode: s, headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "método" });
  try {
    const { code } = JSON.parse(event.body || "{}"); if (!code) throw new Error("sem code");
    const tk = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code", code, redirect_uri: process.env.DISCORD_REDIRECT_URI }),
    }).then((r) => r.json());
    if (!tk.access_token) throw new Error("token inválido");
    const u = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${tk.access_token}` } }).then((r) => r.json());
    if (!u.id) throw new Error("sem usuário");
    const uid = "discord:" + u.id, props = { displayName: u.global_name || u.username };
    if (u.avatar) props.photoURL = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`;
    const auth = admin.auth();
    try { await auth.updateUser(uid, props); }
    catch (e) { if (e.code === "auth/user-not-found") await auth.createUser({ uid, ...props }); else throw e; }
    return json(200, { token: await auth.createCustomToken(uid) });
  } catch (e) { console.error(e); return json(400, { error: "falha" }); }
};
