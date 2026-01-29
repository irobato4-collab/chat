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

/* ===== localStorage ===== */
const KEY_NAME = "chat_username";
const KEY_COLOR = "chat_color";
const KEY_AVATAR = "chat_avatar";
const KEY_UID = "chat_user_id";
const KEY_LAST_SEEN = "chat_last_seen";

/* ===== user ===== */
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
avatarInput.addEventListener("change", e => {
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
  const li = document.createElement("li");
  li.className = "message " + (msg.userId === userId ? "right" : "left");
  li.dataset.id = msg.id;

  li.innerHTML = `
    <div class="meta">
      <div class="msg-name" style="color:${msg.color}">
        ${escapeHtml(msg.name)}
      </div>
      <div class="bubble">
        ${escapeHtml(msg.text)}
        <div class="msg-time">${formatTime(msg.timestamp)}</div>
      </div>
    </div>
    ${msg.userId === userId ? `<button class="msg-button">🗑</button>` : ""}
  `;

  const del = li.querySelector(".msg-button");
  if (del) del.onclick = () => socket.emit("requestDelete", msg.id);

  return li;
}

/* ===== history ===== */
socket.on("history", msgs => {
  messagesEl.innerHTML = "";
  const lastSeen = localStorage.getItem(KEY_LAST_SEEN);
  let notify = false;

  msgs.forEach(m => {
    if (lastSeen && new Date(m.timestamp) > new Date(lastSeen)) notify = true;
    messagesEl.appendChild(makeMessageEl(m));
  });

  if (notify) alert("新しいメッセージがあります");
});

/* ===== receive ===== */
socket.on("chat message", m => {
  messagesEl.appendChild(makeMessageEl(m));
});

/* ===== delete ===== */
socket.on("delete message", id => {
  const el = messagesEl.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
});

/* ===== users ===== */
socket.on("userList", list => {
  userListEl.innerHTML = "";
  onlineCountEl.textContent = `オンライン: ${list.length}`;
  list.forEach(u => {
    const d = document.createElement("div");
    d.textContent = u.name;
    d.style.color = u.color;
    userListEl.appendChild(d);
  });
});

/* ===== send ===== */
function sendMessage(){
  if (!inputEl.value.trim()) return;

  socket.emit("chat message", {
    id: crypto.randomUUID(),
    userId,
    name: username,
    color,
    avatar,
    text: inputEl.value.trim()
  });

  inputEl.value = "";
}

sendBtn.onclick = sendMessage;
inputEl.onkeydown = e => {
  if (e.key === "Enter") sendMessage();
};

/* ===== last seen ===== */
window.addEventListener("beforeunload", () => {
  localStorage.setItem(KEY_LAST_SEEN, new Date().toISOString());
});
