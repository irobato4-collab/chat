const socket = io();

/* =====================
   通知 & 状態管理
===================== */
let myUserId = localStorage.getItem("chat_user_id");
if (!myUserId) {
  myUserId = crypto.randomUUID();
  localStorage.setItem("chat_user_id", myUserId);
}

if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

let lastSeen = localStorage.getItem("chat_last_seen");

/* =====================
   DOM
===================== */
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("m");
const sendBtn = document.getElementById("send");

/* =====================
   メッセージ生成
===================== */
function makeMessageEl(msg) {
  const isSelf = msg.userId === myUserId;

  const li = document.createElement("li");
  li.className = "message " + (isSelf ? "right" : "left");

  const icon = msg.avatar
    ? `<img class="icon" src="${msg.avatar}">`
    : `<div class="icon" style="background:${msg.color}">
         ${msg.name.slice(0,2)}
       </div>`;

  li.innerHTML = `
    ${icon}
    <div class="meta">
      <div class="bubble">${escapeHtml(msg.text)}</div>
    </div>
  `;

  return li;
}

/* =====================
   escape
===================== */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

/* =====================
   履歴
===================== */
socket.on("history", (msgs) => {
  messagesEl.innerHTML = "";

  let hasNew = false;

  msgs.forEach(m => {
    messagesEl.appendChild(makeMessageEl(m));
    if (lastSeen && new Date(m.timestamp) > new Date(lastSeen)) {
      hasNew = true;
    }
  });

  if (
    hasNew &&
    document.visibilityState !== "visible" &&
    Notification.permission === "granted"
  ) {
    new Notification("チャット", {
      body: "新しいメッセージがあります"
    });
  }

  lastSeen = new Date().toISOString();
  localStorage.setItem("chat_last_seen", lastSeen);
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

/* =====================
   新着
===================== */
socket.on("chat message", (msg) => {
  messagesEl.appendChild(makeMessageEl(msg));
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (
    msg.userId !== myUserId &&
    document.visibilityState !== "visible" &&
    Notification.permission === "granted"
  ) {
    new Notification(msg.name, {
      body: msg.text,
      icon: msg.avatar || undefined
    });
  }
});

/* =====================
   送信
===================== */
sendBtn.addEventListener("click", sendMessage);
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
    userId: myUserId,
    text
  });

  inputEl.value = "";
                                }
