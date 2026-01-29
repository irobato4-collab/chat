/* =========================
   modules
========================= */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const webpush = require("web-push");

/* =========================
   environment
========================= */
const PORT = process.env.PORT || 3000;
const ENTRY_PASSWORD = process.env.ENTRY_PASSWORD;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

/* =========================
   web-push setup
========================= */
webpush.setVapidDetails(
  "mailto:admin@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/* =========================
   app / server
========================= */
const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* =========================
   middleware
========================= */
app.use(express.json());
app.use(express.static("public"));

/* =========================
   files
========================= */
const MESSAGE_FILE = "messages.json";
const SUB_FILE = "subscriptions.json";
const MAX_MESSAGES = 100;

/* =========================
   utils
========================= */
function loadJSON(file, def) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(def, null, 2));
    return def;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return def;
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* =========================
   data
========================= */
let messages = loadJSON(MESSAGE_FILE, []);
let subscriptions = loadJSON(SUB_FILE, []);
let users = {}; // socket.id -> user

/* =========================
   entry password check
========================= */
app.post("/check-password", (req, res) => {
  const { password } = req.body;
  res.json({ ok: password === ENTRY_PASSWORD });
});

/* =========================
   push subscribe
========================= */
app.post("/subscribe", (req, res) => {
  const sub = req.body;

  if (!subscriptions.find(s => s.endpoint === sub.endpoint)) {
    subscriptions.push(sub);
    saveJSON(SUB_FILE, subscriptions);
  }

  res.status(201).json({ ok: true });
});

/* =========================
   push send
========================= */
async function sendPush(payload) {
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch {
      subscriptions = subscriptions.filter(s => s !== sub);
      saveJSON(SUB_FILE, subscriptions);
    }
  }
}

/* =========================
   socket.io
========================= */
io.on("connection", (socket) => {
  const auth = socket.handshake.auth?.auth;

  if (auth !== "ok") {
    console.log("unauthorized socket");
    socket.disconnect(true);
    return;
  }

  console.log("authorized:", socket.id);

  // 履歴送信
  socket.emit("history", messages);

  // ユーザー参加
  socket.on("userJoin", (user) => {
    users[socket.id] = user;
    io.emit("userList", Object.values(users));
  });

  // メッセージ受信
  socket.on("chat message", async (msg) => {
    const fullMsg = {
      ...msg,
      time: Date.now()
    };

    messages.push(fullMsg);
    if (messages.length > MAX_MESSAGES) messages.shift();

    saveJSON(MESSAGE_FILE, messages);
    io.emit("chat message", fullMsg);

    // Push通知
    await sendPush({
      title: "新しいメッセージ",
      body: `${msg.name}: ${msg.text}`,
      time: fullMsg.time
    });
  });

  // 自分のメッセージ削除（userId基準）
  socket.on("requestDelete", (id) => {
    const user = users[socket.id];
    if (!user) return;

    messages = messages.filter(
      m => !(m.id === id && m.userId === user.userId)
    );

    saveJSON(MESSAGE_FILE, messages);
    io.emit("delete message", id);
  });

  // 管理者：全削除
  socket.on("adminClearAll", (password) => {
    if (password !== ADMIN_PASSWORD) {
      socket.emit("adminClearFailed", "password error");
      return;
    }

    messages = [];
    saveJSON(MESSAGE_FILE, messages);
    io.emit("clearAllMessages");
  });

  // 切断
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

/* =========================
   start
========================= */
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
