const socket = io();

/* ===== DOM ===== */
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

/* ===== localStorage keys ===== */
const KEY_NAME = "chat_username";
const KEY_COLOR = "chat_color";
const KEY_AVATAR = "chat_avatar";
const KEY_UID = "chat_user_id";
const KEY_LAST_SEEN = "chat_last_seen";

/* ===== user data ===== */
let username = localStorage.getItem(KEY_NAME) || "";
let color = localStorage.getItem(KEY_COLOR) || "#00b900";
let avatar = localStorage.getItem(KEY_AVATAR) || null;
let userId = localStorage.getItem(KEY_UID);

if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem(KEY_UID, userId);
}

/* ===== 初期設定表示 ===== */
function showSetupIfNeeded() {
  if (username && color) {
    setupPanel.style.display = "none";
    socket.emit("userJoin", { userId, name: username, color, avatar });
  } else {
    setupPanel.style.display = "flex";
    usernameInput.value = username;
    colorInput.value = color;
  }
}
showSetupIfNeeded();

/* ===== avatar ===== */
avatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => avatar = reader.result;
  reader.readAsDataURL(file);
});

/* ===== 保存 ===== */
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

/* ===== キャンセル ===== */
cancelSetupBtn.addEventListener("click", () => {
  if (username) setupPanel.style.display = "none";
});

/* ===== 設定開く ===== */
openSettingsBtn.addEventListener("click", () => {
  usernameInput.value = username;
  colorInput.value = color;
  avatarInput.value = "";
  setupPanel.style.display = "flex";
});

/* ===== util ===== */
function escapeHtml(s){
  if (!s && s !== 0) return "";
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function formatTime(iso){
  return new Date(iso).toLocaleString("ja-JP");
}

/* ===== message ===== */
function makeMessageEl(msg){
  const isSelf = msg.userId === userId;

  const li = document.createElement("li");
  li.className = "message " + (isSelf ? "right" : "left");
  li.dataset.id = msg.id;

  // icon
  let iconHtml = "";
  if (msg.avatar) {
    iconHtml = `<img class="icon" src="${msg.avatar}" alt="avatar">`;
  } else {
    const initials = (msg.name || "?")
      .split(" ")
      .map(s => s[0])
      .join("")
      .slice(0,2)
      .toUpperCase();
    iconHtml = `<div class="icon" style="background:${msg.color}">${initials}</div>`;
  }

  li.innerHTML = `
    ${iconHtml}
    <div class="meta">
      <div class="msg-name" style="color:${msg.color}">
        ${escapeHtml(msg.name)}
        <span class="msg-time">${formatTime(msg.timestamp)}</span>
      </div>
      <div class="bubble">
        ${escapeHtml(msg.text)}
      </div>
    </div>
    ${isSelf ? `<button class="msg-button">🗑</button>` : ""}
  `;

  const del = li.querySelector(".msg-button");
  if (del) {
    del.onclick = () => socket.emit("requestDelete", msg.id);
  }

  return li;
}

/* ===== history ===== */
socket.on("history", (msgs) => {
  messagesEl.innerHTML = "";
  const lastSeen = localStorage.getItem(KEY_LAST_SEEN);
  let notify = false;

  msgs.forEach(m => {
    if (lastSeen && new Date(m.timestamp) > new Date(lastSeen)) {
      notify = true;
    }
    messagesEl.appendChild(makeMessageEl(m));
  });

  if (notify) {
    alert("新しいメッセージがあります");
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
});

/* ===== receive ===== */
socket.on("chat message", (msg) => {
  messagesEl.appendChild(makeMessageEl(msg));
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

/* ===== delete ===== */
socket.on("delete message", (id) => {
  const el = messagesEl.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
});

/* ===== users ===== */
socket.on("userList", (list) => {
  userListEl.innerHTML = "";
  onlineCountEl.textContent = `オンライン: ${list.length}`;

  list.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-item";

    let imgHtml = "";
    if (u.avatar) {
      imgHtml = `<img class="uimg" src="${u.avatar}" alt="u">`;
    } else {
      const initials = (u.name || "?")
        .split(" ")
        .map(s => s[0])
        .join("")
        .slice(0,2)
        .toUpperCase();
      imgHtml = `<div class="uimg" style="background:${u.color}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700">${initials}</div>`;
    }

    div.innerHTML = `${imgHtml}<div class="uname" style="color:${u.color}">${escapeHtml(u.name)}</div>`;
    userListEl.appendChild(div);
  });
});

/* ===== send ===== */
function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  socket.emit("chat message", {
    id: crypto.randomUUID(),
    userId,
    name: username,
    color,
    avatar,
    text
  });

  inputEl.value = "";
}

sendBtn.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* ===== last seen ===== */
window.addEventListener("beforeunload", () => {
  localStorage.setItem(KEY_LAST_SEEN, new Date().toISOString());
});
