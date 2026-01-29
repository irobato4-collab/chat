const socket = io();

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

/* ===== DOM ===== */
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("m");
const sendBtn = document.getElementById("send");
const userListEl = document.getElementById("userList");
const onlineCountEl = document.getElementById("onlineCount");

/* ===== util ===== */
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function formatTime(iso){
  const d = new Date(iso);
  return d.toLocaleString("ja-JP");
}

/* ===== message UI ===== */
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

  if (notify) alert("新しいメッセージがあります");
});

/* ===== receive ===== */
socket.on("chat message", (msg) => {
  messagesEl.appendChild(makeMessageEl(msg));
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

/* ===== join ===== */
socket.emit("userJoin", { userId, name: username, color, avatar });

/* ===== last seen ===== */
window.addEventListener("beforeunload", () => {
  localStorage.setItem(KEY_LAST_SEEN, new Date().toISOString());
});
