// ===== socket =====
const socket = io();

// ===== DOM =====
const messages = document.getElementById("messages");
const input = document.getElementById("m");
const sendBtn = document.getElementById("send");
const userList = document.getElementById("userList");
const onlineCount = document.getElementById("onlineCount");
const setupPanel = document.getElementById("setupPanel");

// ===== ユーザー情報 =====
let user = null;

// userId を永続化（名前変えても同一人物）
let userId = localStorage.getItem("userId");
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}

// 最終アクセス時間（通知用）
let lastAccess = Number(localStorage.getItem("lastAccess") || Date.now());
localStorage.setItem("lastAccess", Date.now());

// ===== PWA / Service Worker =====
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

// 通知許可
async function requestNotifyPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}
requestNotifyPermission();

// ===== 初期設定 =====
function openSetup(force = false) {
  if (user && !force) return;
  setupPanel.style.display = "flex";
}

document.getElementById("saveSettings").onclick = async () => {
  const name = document.getElementById("usernameInput").value.trim();
  const color = document.getElementById("colorInput").value;
  const avatarFile = document.getElementById("avatarInput").files[0];

  if (!name) return alert("名前を入力してください");

  let avatar = null;
  if (avatarFile) {
    avatar = await fileToBase64(avatarFile);
  }

  user = { id: userId, name, color, avatar };
  localStorage.setItem("user", JSON.stringify(user));

  setupPanel.style.display = "none";
  socket.emit("userJoin", user);
};

document.getElementById("cancelSetup").onclick = () => {
  setupPanel.style.display = "none";
};

document.getElementById("openSettings").onclick = () => {
  openSetup(true);
};

// ===== localStorage から復元 =====
const savedUser = localStorage.getItem("user");
if (savedUser) {
  user = JSON.parse(savedUser);
  socket.emit("userJoin", user);
} else {
  openSetup();
}

// ===== メッセージ送信 =====
sendBtn.onclick = sendMessage;
input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  if (!input.value.trim() || !user) return;

  const msg = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: user.name,
    color: user.color,
    avatar: user.avatar,
    text: input.value,
    time: Date.now()
  };

  socket.emit("chat message", msg);
  input.value = "";
}

// ===== メッセージ描画 =====
function renderMessage(msg, isHistory = false) {
  const li = document.createElement("li");
  const isSelf = msg.userId === userId;

  li.className = `message ${isSelf ? "right" : "left"}`;
  li.dataset.id = msg.id;

  // icon
  const icon = document.createElement("div");
  icon.className = "icon";
  if (msg.avatar) {
    icon.style.background = "none";
    icon.innerHTML = `<img src="${msg.avatar}" style="width:100%;height:100%;border-radius:50%">`;
  } else {
    icon.style.background = msg.color;
    icon.textContent = msg.name[0];
  }

  // meta
  const meta = document.createElement("div");
  meta.className = "meta";

  const name = document.createElement("div");
  name.className = "msg-name";
  name.style.color = msg.color;
  name.textContent = msg.name;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = msg.text;

  meta.appendChild(name);
  meta.appendChild(bubble);

  li.appendChild(icon);
  li.appendChild(meta);

  // 削除（自分のメッセージのみ）
  if (isSelf) {
    const tools = document.createElement("div");
    tools.className = "msg-tools";

    const del = document.createElement("button");
    del.className = "msg-button";
    del.textContent = "削除";
    del.onclick = () => {
      socket.emit("requestDelete", msg.id);
    };

    tools.appendChild(del);
    li.appendChild(tools);
  }

  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;

  // ===== 通知判定 =====
  if (
    !isSelf &&
    !isHistory &&
    msg.time > lastAccess &&
    document.visibilityState !== "visible" &&
    navigator.serviceWorker.controller
  ) {
    navigator.serviceWorker.controller.postMessage({
      type: "NOTIFY",
      text: `${msg.name}: ${msg.text}`
    });
  }
}

// ===== socket events =====
socket.on("history", data => {
  data.forEach(msg => renderMessage(msg, true));
});

socket.on("chat message", msg => {
  renderMessage(msg);
});

socket.on("delete message", id => {
  const el = messages.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
});

socket.on("userList", list => {
  userList.innerHTML = "";
  onlineCount.textContent = `オンライン: ${list.length}`;

  list.forEach(u => {
    const item = document.createElement("div");
    item.className = "user-item";

    const img = document.createElement("div");
    img.className = "uimg";
    if (u.avatar) {
      img.innerHTML = `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%">`;
    } else {
      img.style.background = u.color;
      img.style.color = "#fff";
      img.style.display = "flex";
      img.style.alignItems = "center";
      img.style.justifyContent = "center";
      img.textContent = u.name[0];
    }

    const name = document.createElement("div");
    name.className = "uname";
    name.textContent = u.name;

    item.appendChild(img);
    item.appendChild(name);
    userList.appendChild(item);
  });
});

// ===== utility =====
function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
     }
