const socket = io();

/* =========================
   IndexedDB 設定
========================= */

const DB_NAME = "chatAppDB";
const STORE_NAME = "userStore";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject("DB open failed");
  });
}

async function saveUserToDB(user) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(user, "profile");
}

async function loadUserFromDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  return new Promise(resolve => {
    const req = tx.objectStore(STORE_NAME).get("profile");
    req.onsuccess = () => resolve(req.result || null);
  });
}

/* =========================
   DOM
========================= */

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

/* =========================
   ユーザー情報
========================= */

let userId = crypto.randomUUID();
let username = "";
let color = "#00b900";
let avatar = null;

/* =========================
   初期化
========================= */

(async function init() {
  const saved = await loadUserFromDB();

  if (saved) {
    userId = saved.userId;
    username = saved.name;
    color = saved.color;
    avatar = saved.avatar;

    setupPanel.style.display = "none";
    socket.emit("userJoin", { userId, name: username, color, avatar });
  } else {
    setupPanel.style.display = "flex";
  }
})();

/* =========================
   Avatar 読み込み
========================= */

avatarInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    avatar = reader.result;
  };
  reader.readAsDataURL(file);
});

/* =========================
   設定保存
========================= */

saveSettingsBtn.addEventListener("click", async () => {
  const name = usernameInput.value.trim();
  if (!name) return alert("名前を入力してください");

  username = name;
  color = colorInput.value;

  const userData = {
    userId,
    name: username,
    color,
    avatar,
    lastAccess: Date.now()
  };

  await saveUserToDB(userData);

  socket.emit("userJoin", { userId, name: username, color, avatar });
  setupPanel.style.display = "none";
});

cancelSetupBtn.addEventListener("click", () => {
  if (!username) {
    alert("名前を入力してください");
    return;
  }
  setupPanel.style.display = "none";
});

openSettingsBtn.addEventListener("click", () => {
  usernameInput.value = username;
  colorInput.value = color;
  avatarInput.value = "";
  setupPanel.style.display = "flex";
});

/* =========================
   メッセージ生成
========================= */

function makeMessageEl(msg) {
  const isSelf = msg.userId === userId;

  const li = document.createElement("li");
  li.className = `message ${isSelf ? "right" : "left"}`;
  li.dataset.id = msg.id;

  const icon = msg.avatar
    ? `<img class="icon" src="${msg.avatar}">`
    : `<div class="icon" style="background:${msg.color}">
         ${msg.name.slice(0, 2).toUpperCase()}
       </div>`;

  const tools = isSelf
    ? `<div class="msg-tools">
         <button class="msg-button delete">🗑</button>
       </div>`
    : "";

  li.innerHTML = `
    ${icon}
    <div class="meta">
      <div class="msg-name" style="color:${msg.color}">${escapeHtml(msg.name)}</div>
      <div class="bubble">${escapeHtml(msg.text)}</div>
    </div>
    ${tools}
  `;

  if (isSelf) {
    li.querySelector(".delete").onclick = () => {
      socket.emit("requestDelete", msg.id);
    };
  }

  return li;
}

/* =========================
   socket.io
========================= */

socket.on("history", msgs => {
  messagesEl.innerHTML = "";
  msgs.forEach(m => messagesEl.appendChild(makeMessageEl(m)));
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

socket.on("chat message", msg => {
  messagesEl.appendChild(makeMessageEl(msg));
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

socket.on("userList", list => {
  userListEl.innerHTML = "";
  onlineCountEl.textContent = `オンライン: ${list.length}`;

  list.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-item";

    const img = u.avatar
      ? `<img class="uimg" src="${u.avatar}">`
      : `<div class="uimg" style="background:${u.color}">
           ${u.name.slice(0, 2).toUpperCase()}
         </div>`;

    div.innerHTML = `${img}<div class="uname">${escapeHtml(u.name)}</div>`;
    userListEl.appendChild(div);
  });
});

socket.on("delete message", id => {
  const el = messagesEl.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
});

/* =========================
   送信
========================= */

sendBtn.onclick = sendMessage;
inputEl.onkeydown = e => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
};

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  const msg = {
    id: crypto.randomUUID(),
    userId,
    name: username,
    color,
    avatar,
    text
  };

  socket.emit("chat message", msg);
  inputEl.value = "";
}

/* =========================
   util
========================= */

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* =========================
   Service Worker 登録
========================= */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(() => console.log("Service Worker registered"))
      .catch(err => console.error("SW failed", err));
  });
}
