const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const fs = require("fs");
const path = require("path");

/* =====================
   static
===================== */
app.use(express.static("public"));

/* =====================
   env
===================== */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.warn("⚠ ADMIN_PASSWORD is not set");
}

/* =====================
   settings
===================== */
const FILE = "messages.json";
const MAX_MESSAGES = 100;

/* =====================
   users
===================== */
// socket.id -> { name, color, avatar, userId }
let users = {};

/* =====================
   message storage
===================== */
function loadMessages() {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, "[]");
      return [];
    }
    const raw = fs.readFileSync(FILE, "utf8");
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("loadMessages error:", e);
    fs.writeFileSync(FILE, "[]");
    return [];
  }
}

function saveMessages(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

/* 起動時整理 */
(function normalizeMessages() {
  let data = loadMessages();
  if (data.length > MAX_MESSAGES) {
    saveMessages(data.slice(-MAX_MESSAGES));
  }
})();

/* =====================
   socket.io
===================== */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  /* 履歴送信 */
  socket.emit("history", loadMessages());

  /* user join */
  socket.on("userJoin", (user) => {
    users[socket.id] = {
      name: user.name,
      color: user.color,
      avatar: user.avatar || null,
      userId: user.userId
    };
    io.emit("userList", Object.values(users));
  });

  /* message */
  socket.on("chat message", (msg) => {
    let data = loadMessages();

    const message = {
      id: msg.id,
      userId: msg.userId,
      name: msg.name,
      color: msg.color,
      avatar: msg.avatar || null,
      text: msg.text,
      timestamp: msg.timestamp || new Date().toISOString()
    };

    data.push(message);

    while (data.length > MAX_MESSAGES) {
      data.shift();
    }

    saveMessages(data);
    io.emit("chat message", message);
  });

  /* delete (userId based) */
  socket.on("requestDelete", (id) => {
    const currentUser = users[socket.id];
    if (!currentUser) return;

    let data = loadMessages();
    const msg = data.find(m => m.id === id);
    if (!msg) return;

    if (msg.userId !== currentUser.userId) return;

    data = data.filter(m => m.id !== id);
    saveMessages(data);
    io.emit("delete message", id);
  });

  /* admin clear */
  socket.on("adminClearAll", (password) => {
    if (password !== ADMIN_PASSWORD) {
      socket.emit("adminClearFailed", "パスワードが違います");
      return;
    }

    saveMessages([]);
    io.emit("clearAllMessages");
    console.log("Admin cleared all messages");
  });

  /* disconnect */
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
    console.log("User disconnected:", socket.id);
  });
});

/* =====================
   start
===================== */
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
