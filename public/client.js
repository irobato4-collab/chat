// =========================
// Socket.io
// =========================
const socket = io();

// =========================
// DOM Elements
// =========================
const setupPanel = document.getElementById("setupPanel");
const usernameInput = document.getElementById("usernameInput");
const colorInput = document.getElementById("colorInput");
const avatarInput = document.getElementById("avatarInput");
const saveSettingsBtn = document.getElementById("saveSettings");
const cancelSetupBtn = document.getElementById("cancelSetup");
const openSettingsBtn = document.getElementById("openSettings");

const messagesEl = document.getElementById("messages");
const userListEl = document.getElementById("userList");
const onlineCountEl = document.getElementById("onlineCount");
const inputEl = document.getElementById("m");
const sendBtn = document.getElementById("send");

const adminClearBtn = document.getElementById("adminClearBtn");

// =========================
// IndexedDB 保存
// =========================
let db;
const request = indexedDB.open("chatAppDB", 1);
request.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("settings")) {
    db.createObjectStore("settings");
  }
};
request.onsuccess = (e) => {
  db = e.target.result;
  loadSettings();
};
request.onerror = (e) => console.error("DB error", e);

// =========================
// ユーザー設定
// =========================
let username = "";
let color = "#00b900";
let avatar = null; // base64
let userId = null;

function saveSettingsToDB() {
  const tx = db.transaction("settings", "readwrite");
  const store = tx.objectStore("settings");
  store.put(username, "username");
  store.put(color, "color");
  store.put(avatar, "avatar");
  store.put(userId, "userId");
}

function loadSettings() {
  const tx = db.transaction("settings", "readonly");
  const store = tx.objectStore("settings");
  store.get("username").onsuccess = (e) => {
    if (e.target.result) username = e.target.result;
    store.get("color").onsuccess = (e) => {
      if (e.target.result) color = e.target.result;
      store.get("avatar").onsuccess = (e) => {
        if (e.target.result) avatar = e.target.result;
        store.get("userId").onsuccess = (e) => {
          if (e.target.result) userId = e.target.result;
          showSetupIfNeeded();
        };
      };
    };
  };
}

// =========================
// 初回設定モーダル
// =========================
function showSetupIfNeeded() {
  if (!username || !color || !userId) {
    setupPanel.style.display = "flex";
    usernameInput.value = username;
    colorInput.value = color;
    return;
  }
  setupPanel.style.display = "none";
  joinServer();
}

function joinServer() {
  socket.emit("userJoin", { name: username, color, avatar, userId });
}

// =========================
// Avatarファイル
// =========================
avatarInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    avatar = reader.result;
  };
  reader.readAsDataURL(file);
});

// =========================
// 設定保存
// =========================
saveSettingsBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  const col = colorInput.value;

  if (!name) return alert("名前を入力してください");

  username = name;
  color = col;
  if (!userId) userId = crypto.randomUUID();

  saveSettingsToDB();
  setupPanel.style.display = "none";
  joinServer();
});

cancelSetupBtn.addEventListener("click", () => {
  if (!username) return alert("名前を入力してから開始してください");
  setupPanel.style.display = "none";
});

openSettingsBtn.addEventListener("click", () => {
  usernameInput.value = username || "";
  colorInput.value = color || "#00b900";
  avatarInput.value = "";
  setupPanel.style.display = "flex";
});

// =========================
// メッセージ作成
// =========================
function makeMessageEl(msg) {
  const isSelf = msg.userId === userId;
  const li = document.createElement("li");
  li.className = "message " + (isSelf ? "right" : "left");
  li.dataset.id = msg.id;

  let iconHtml = "";
  if (msg.avatar) {
    iconHtml = `<img class="icon" src="${msg.avatar}" alt="avatar">`;
  } else {
    const initials = (msg.name||"?").split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase();
    iconHtml = `<div class="icon" style="background:${msg.color};">${initials}</div>`;
  }

  let toolsHtml = "";
  if (isSelf) {
    toolsHtml = `
      <div class="msg-tools">
        <button class="msg-button open-menu">…</button>
        <button class="msg-button delete" title="削除">🗑</button>
      </div>
    `;
  }

  li.innerHTML = `
    ${iconHtml}
    <div class="meta">
      <div class="msg-name" style="color:${msg.color}">${escapeHtml(msg.name)}</div>
      <div class="bubble">${escapeHtml(msg.text)}</div>
    </div>
    ${toolsHtml}
  `;

  // Delete button
  if (isSelf) {
    const delBtn = li.querySelector(".delete");
    if (delBtn) delBtn.addEventListener("click", () => {
      socket.emit("requestDelete", msg.id);
    });
    const openBtn = li.querySelector(".open-menu");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        const del = li.querySelector(".delete");
        if (del) del.style.display = del.style.display==="inline-block"?"none":"inline-block";
      });
      li.querySelector(".delete").style.display = "none";
    }
  }

  return li;
}

function escapeHtml(s){
  if (!s && s!==0) return "";
  return String(s).replaceAll("&","&amp;")
    .replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

// =========================
// Socket イベント
// =========================
socket.on("history", msgs => {
  messagesEl.innerHTML = "";
  msgs.forEach(m => {
    const el = makeMessageEl(m);
    messagesEl.appendChild(el);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

socket.on("chat message", m => {
  const el = makeMessageEl(m);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // 通知
  if (Notification.permission === "granted" && m.userId !== userId) {
    new Notification(m.name, { body: m.text });
  }
});

socket.on("userList", list => {
  userListEl.innerHTML = "";
  onlineCountEl.textContent = `オンライン: ${list.length}`;
  list.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-item";
    let imgHtml = "";
    if (u.avatar) imgHtml = `<img class="uimg" src="${u.avatar}" alt="u">`;
    else {
      const initials = (u.name||"?").split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase();
      imgHtml = `<div class="uimg" style="background:${u.color}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700">${initials}</div>`;
    }
    div.innerHTML = `${imgHtml}<div class="uname" style="color:${u.color}">${escapeHtml(u.name)}</div>`;
    userListEl.appendChild(div);
  });
});

socket.on("delete message", id => {
  const el = messagesEl.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
});
socket.on("deleteFailed", ({id, reason}) => alert("削除に失敗しました: "+reason));

socket.on("clearAllMessages", () => {
  messagesEl.innerHTML = "";
  alert("全メッセージを削除しました");
});
socket.on("adminClearFailed", msg => alert("管理者操作失敗: "+msg));

// =========================
// 送信
// =========================
sendBtn.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", e => {
  if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  if (!username || !userId) { setupPanel.style.display="flex"; return; }

  const msg = {
    id: crypto.randomUUID(),
    name: username,
    color,
    avatar,
    text,
    userId,
    time: new Date().toISOString()
  };

  socket.emit("chat message", msg);
  inputEl.value="";
}

// =========================
// 管理者全削除
// =========================
if (adminClearBtn) {
  adminClearBtn.addEventListener("click", () => {
    const password = prompt("管理者パスワードを入力してください");
    if (!password) return;
    socket.emit("adminClearAll", password);
  });
}

// =========================
// Notification 権限要求
// =========================
if ('Notification' in window) {
  if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }
}

// =========================
// ページ読み込み時 join
// =========================
if (username && userId) joinServer();

// =========================
// Service Worker 登録 (PWA対応)
// =========================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log("Service Worker registered", reg))
      .catch(err => console.error("SW registration failed", err));
  });
                }
