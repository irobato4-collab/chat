/* =========================
   socket
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
const KEY_NAME = "chat_username";
const KEY_COLOR = "chat_color";
const KEY_AVATAR = "chat_avatar";
const KEY_USERID = "chat_userid";
const KEY_LAST_SEEN = "chat_last_seen";

/* =========================
   user info
========================= */
let username = localStorage.getItem(KEY_NAME) || "";
let color = localStorage.getItem(KEY_COLOR) || "#00b900";
let avatar = localStorage.getItem(KEY_AVATAR) || null;

// userId は一度生成したら永続
let userId = localStorage.getItem(KEY_USERID);
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem(KEY_USERID, userId);
}

/* =========================
   Notification permission
========================= */
if ("Notification" in window) {
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

/* =========================
   setup
========================= */
function showSetupIfNeeded() {
  if (username && color) {
    setupPanel.style.display = "none";
    socket.emit("userJoin", { name: username, color, avatar, userId });
  } else {
    setupPanel.style.display = "flex";
    usernameInput.value = username;
    colorInput.value = color;
  }
}
showSetupIfNeeded();

/* avatar load */
avatarInput.addEventListener("change", () => {
  const file = avatarInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => avatar = reader.result;
  reader.readAsDataURL(file);
});

/* save settings */
saveSettingsBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  if (!name) return alert("名前を入力してください");

  username = name;
  color = colorInput.value;

  localStorage.setItem(KEY_NAME, username);
  localStorage.setItem(KEY_COLOR, color);
  if (avatar) localStorage.setItem(KEY_AVATAR, avatar);

  socket.emit("userJoin", { name: username, color, avatar, userId });
  setupPanel.style.display = "none";
});

/* cancel */
cancelSetupBtn.addEventListener("click", () => {
  if (username) setupPanel.style.display = "none";
});

/* reopen */
openSettingsBtn.addEventListener("click", () => {
  usernameInput.value = username;
  colorInput.value = color;
  avatarInput.value = "";
  setupPanel.style.display = "flex";
});

/* =========================
   message render
========================= */
function makeMessageEl(msg) {
  const isSelf = msg.userId === userId;

  const li = document.createElement("li");
  li.className = `message ${isSelf ? "right" : "left"}`;
  li.dataset.id = msg.id;

  // icon
  let icon;
  if (msg.avatar) {
    icon = `<img class="icon" src="${msg.avatar}">`;
  } else {
    const ini = msg.name?.[0]?.toUpperCase() || "?";
    icon = `<div class="icon" style="background:${msg.color}">${ini}</div>`;
  }

  // delete tool
  let tools = "";
  if (isSelf) {
    tools = `
      <div class="msg-tools">
        <button class="msg-button delete">🗑</button>
      </div>
    `;
  }

  li.innerHTML = `
    ${icon}
    <div class="meta">
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
   escape
========================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================
   history
========================= */
socket.on("history", (messages) => {
  messagesEl.innerHTML = "";

  const lastSeen = localStorage.getItem(KEY_LAST_SEEN);
  let hasUnread = false;

  messages.forEach(m => {
    if (lastSeen && new Date(m.timestamp) > new Date(lastSeen)) {
      hasUnread = true;
    }
    messagesEl.appendChild(makeMessageEl(m));
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (
    hasUnread &&
    document.visibilityState !== "visible" &&
    Notification.permission === "granted"
  ) {
    new Notification("Chat Room", {
      body: "新しいメッセージがあります"
    });
  }

  localStorage.setItem(KEY_LAST_SEEN, new Date().toISOString());
});

/* =========================
   realtime message
========================= */
socket.on("chat message", (msg) => {
  messagesEl.appendChild(makeMessageEl(msg));
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (
    msg.userId !== userId &&
    document.visibilityState !== "visible" &&
    Notification.permission === "granted"
  ) {
    new Notification(msg.name, {
      body: msg.text,
      icon: msg.avatar || undefined
    });
  }
});

/* =========================
   delete
========================= */
socket.on("delete message", (id) => {
  const el = messagesEl.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
});

/* =========================
   user list
========================= */
socket.on("userList", (list) => {
  userListEl.innerHTML = "";
  onlineCountEl.textContent = `オンライン: ${list.length}`;

  list.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-item";

    let img = u.avatar
      ? `<img class="uimg" src="${u.avatar}">`
      : `<div class="uimg" style="background:${u.color};color:#fff;display:flex;align-items:center;justify-content:center">${u.name[0]}</div>`;

    div.innerHTML = `${img}<div class="uname" style="color:${u.color}">${escapeHtml(u.name)}</div>`;
    userListEl.appendChild(div);
  });
});

/* =========================
   send
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

  socket.emit("chat message", {
    id: crypto.randomUUID(),
    userId,
    name: username,
    color,
    avatar,
    text,
    timestamp: new Date().toISOString()
  });

  inputEl.value = "";
}
