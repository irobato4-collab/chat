// index.js

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const fs = require("fs");

app.use(express.static("public"));

/* ===== 設定 ===== */
const FILE = "messages.json";
const MAX_MESSAGES = 100;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ENTRY_PASSWORD = process.env.ENTRY_PASSWORD;

let users = {}; // socket.id -> { userId, name, color, avatar }

/* ===== 認証 ===== */
app.get("/auth", (req, res) => {
  if (req.query.p === ENTRY_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.json({ ok: false });
  }
});

/* ===== messages.json 安全処理 ===== */
function loadMessages() {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, "[]");
      return [];
    }
    return JSON.parse(fs.readFileSync(FILE, "utf8") || "[]");
  } catch {
    fs.writeFileSync(FILE, "[]");
    return [];
  }
}

function saveMessages(data) {
  fs.writeFileSync(FILE, JSON.stringify(data.slice(-MAX_MESSAGES), null, 2));
}

/* ===== socket.io ===== */
io.on("connection", (socket) => {
  console.log("connect:", socket.id);

  socket.emit("history", loadMessages());

  socket.on("userJoin", (user) => {
    users[socket.id] = user;
    io.emit("userList", Object.values(users));
  });

  socket.on("chat message", (msg) => {
    const data = loadMessages();

    const saved = {
      id: msg.id,
      userId: msg.userId,
      name: msg.name,
      color: msg.color,
      avatar: msg.avatar ?? null,
      text: msg.text,
      timestamp: new Date().toISOString()
    };

    data.push(saved);
    saveMessages(data);
    io.emit("chat message", saved);
  });

  socket.on("requestDelete", (id) => {
    const current = users[socket.id];
    if (!current) return;

    let data = loadMessages();
    const msg = data.find(m => m.id === id);
    if (!msg) return;

    if (msg.userId !== current.userId) {
      socket.emit("deleteFailed", { id, reason: "not-owner" });
      return;
    }

    data = data.filter(m => m.id !== id);
    saveMessages(data);
    io.emit("delete message", id);
  });

  socket.on("adminClearAll", (pw) => {
    if (pw !== ADMIN_PASSWORD) {
      socket.emit("adminClearFailed", "パスワード不一致");
      return;
    }
    saveMessages([]);
    io.emit("clearAllMessages");
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

/* ===== 起動 ===== */
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log("Server running:", PORT);
});
