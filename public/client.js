/* =========================
   socket.io
========================= */
const socket = io();

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
   localStorage keys
========================= */
const KEY_USERID = "chat_user_id";
const KEY_NAME = "chat_username";
const KEY_COLOR = "chat_color";
const KEY_AVATAR = "chat_avatar";

/* =========================
   永続 userId
========================= */
let userId = localStorage.getItem(KEY_USERID);
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem(KEY_USERID, userId);
}

/* =========================
   設定ロード
========================= */
let username = localStorage.getItem(KEY_NAME) || "";
let color = localStorage.getItem(KEY_COLOR) || "#00b900";
let avatar = localStorage.getItem(KEY_AVATAR) || null;

/* =========================
   初回設定表示制御
========================= */
function showSetupIfNeeded() {
  if (username && color) {
    setupPanel.style.display = "none";
    socket.emit("userJoin", { userId, name: username, color, avatar });
  } else {
    setupPanel.style.display = "flex";
  }
}
showSetupIfNeeded();

/* =========================
   avatar 読み込み
========================= */
avatarInput.addEventListener("change", (e) => {
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
saveSettingsBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  if (!name) {
    alert("名前を入力してください");
    return;
  }

  username = name;
  color = colorInput.value;

  localStorage.setItem(KEY_NAME, username);
  localStorage.setItem(KEY_COLOR, color);
  if (avatar) localStorage.setItem(KEY_AVATAR, avatar);

  socket.emit("userJoin", { userId, name: username, color, avatar });
  setupPanel.style.display = "none";
});

cancelSetupBtn.addEventListener("click", () => {
  if (username) setupPanel.style.display = "none";
});

/* =========================
   再設定
========================= */
openSettingsBtn.addEventListener("click", () => {
  usernameInput.value = username;
  colorInput.value = color;
  avatarInput.value = "";
  setupPanel.style.display = "flex";
});

/* =========================
   HTML escape
========================= */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   メッセージ生成
========================= */
function makeMessageEl(msg) {
  const isSelf = msg.userId === userId;

  const li = document.createElement("li");
  li.className = "message " + (isSelf ? "right" : "left");
  li.dataset.id = msg.id;

  let iconHtml;
  if (msg.avatar) {
    iconHtml = `<img class="icon" src="${msg.avatar}">`;
  } else {
    const ini = msg.name.slice(0, 2).toUpperCase();
    iconHtml = `<div class="icon" style="background:${msg.color}">${ini}</div>`;
  }

  let tools = "";
  if (isSelf) {
    tools = `
      <div class="msg-tools">
        <button class="msg-button delete">🗑</button>
      </div>
    `;
  }

  li.innerHTML = `
    ${iconHtml}
    <div class="meta">
      <div class="msg-name" style="color:${msg.color}">
        ${escapeHtml(msg.name)}
      </div>
      <div class="bubble">
        ${escapeHtml(msg.text)}
      </div>
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
   履歴
========================= */
socket.on("history", (msgs) => {
  messagesEl.innerHTML = "";
  msgs.forEach(m => messagesEl.appendChild(makeMessageEl(m)));
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

/* =========================
   新着
========================= */
socket.on("chat message", (msg) => {
  messagesEl.appendChild(makeMessageEl(msg));
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

/* =========================
   削除反映
========================= */
socket.on("delete message", (id) => {
  const el = messagesEl.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
});

/* =========================
   ユーザー一覧
========================= */
socket.on("userList", (list) => {
  userListEl.innerHTML = "";
  onlineCountEl.textContent = `オンライン: ${list.length}`;

  list.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-item";

    const img = u.avatar
      ? `<img class="uimg" src="${u.avatar}">`
      : `<div class="uimg" style="background:${u.color}">${u.name[0]}</div>`;

    div.innerHTML = `${img}<div class="uname" style="color:${u.color}">${escapeHtml(u.name)}</div>`;
    userListEl.appendChild(div);
  });
});

/* =========================
   送信
========================= */
sendBtn.onclick = sendMessage;
inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

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
   PWA Push 購読
========================= */
if ("serviceWorker" in navigator && "PushManager" in window) {
  navigator.serviceWorker.ready.then(async reg => {
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = window.VAPID_PUBLIC_KEY;
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      });
      await fetch("/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSub)
      });
    }
  });
}
