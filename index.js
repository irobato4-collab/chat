require('dotenv').config(); // 環境変数読み込み
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

// =========================
// 環境変数
// =========================
const ENTRY_PASSWORD = process.env.ENTRY_PASSWORD || "changeme"; // 管理者パスワード
const VAPID_PUBLIC = process.env.VAPID_PUBLIC || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || "";

webpush.setVapidDetails(
  "mailto:admin@example.com",
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// =========================
// 設定
// =========================
const FILE = "messages.json";
const MAX_MESSAGES = 100;

let users = {}; // socket.id -> { name, color, avatar, userId }
let subscriptions = []; // push subscriptions

app.use(express.static("public"));
app.use(express.json());

// =========================
// messages.json 読み書き
// =========================
function loadMessages() {
  try {
    if (!fs.existsSync(FILE)) { fs.writeFileSync(FILE,"[]"); return []; }
    const raw = fs.readFileSync(FILE,"utf8");
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch(e){
    console.error("loadMessages error:",e);
    fs.writeFileSync(FILE,"[]");
    return [];
  }
}

function saveMessages(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

// 起動時に100件以上削除
(function normalizeMessages() {
  let data = loadMessages();
  if (data.length > MAX_MESSAGES) {
    data = data.slice(data.length - MAX_MESSAGES);
    saveMessages(data);
  }
})();

// =========================
// Web Push Subscription
// =========================
app.post("/subscribe", (req, res) => {
  const sub = req.body;
  subscriptions.push(sub);
  res.status(201).json({});
});

// =========================
// socket.io
// =========================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 履歴送信
  socket.emit("history", loadMessages());

  // ユーザー参加
  socket.on("userJoin", (user) => {
    users[socket.id] = {
      name: user.name,
      color: user.color,
      avatar: user.avatar || null,
      userId: user.userId
    };
    io.emit("userList", Object.values(users));
  });

  // メッセージ受信
  socket.on("chat message", (msg) => {
    let data = loadMessages();
    data.push(msg);

    while (data.length > MAX_MESSAGES) data.shift();

    saveMessages(data);
    io.emit("chat message", msg);

    // Push通知送信（自分以外）
    subscriptions.forEach(sub => {
      try {
        webpush.sendNotification(sub, JSON.stringify({
          title: msg.name,
          body: msg.text
        })).catch(err => console.error(err));
      } catch(e){}
    });
  });

  // 削除リクエスト
  socket.on("requestDelete", (id) => {
    const user = users[socket.id];
    if (!user) return socket.emit("deleteFailed", {id, reason:"not-joined"});

    let data = loadMessages();
    const msg = data.find(m=>m.id===id);
    if (!msg) return socket.emit("deleteFailed", {id, reason:"not-found"});

    if (msg.userId !== user.userId) return socket.emit("deleteFailed",{id, reason:"not-owner"});

    data = data.filter(m=>m.id!==id);
    saveMessages(data);
    io.emit("delete message", id);
  });

  // 管理者全削除
  socket.on("adminClearAll", (password) => {
    if (password !== ENTRY_PASSWORD) {
      return socket.emit("adminClearFailed","管理者パスワードが違います");
    }
    saveMessages([]);
    io.emit("clearAllMessages");
    console.log("Admin cleared all messages");
  });

  // 切断
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
    console.log("User disconnected:", socket.id);
  });
});

// =========================
// サーバー起動
// =========================
const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=>console.log("Server running on port "+PORT));
