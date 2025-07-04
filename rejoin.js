#!/usr/bin/env node

const { execSync, exec } = require("child_process");
const readline = require("readline");
const axios = require("axios");
const path = require("path");

// 📦 Cài thư viện nếu thiếu
function ensureDeps() {
  const deps = ["axios"];
  deps.forEach(dep => {
    try {
      require.resolve(dep);
    } catch {
      console.log(`📦 Đang cài ${dep}...`);
      execSync(`npm install ${dep}`, { stdio: "inherit" });
    }
  });
}

// 🔧 Cài su, which, wake lock nếu thiếu
function ensureBinaries() {
  try {
    execSync("which su");
  } catch {
    console.log("⚙️ Đang cài 'su'...");
    execSync("pkg install -y tsu", { stdio: "inherit" });
  }

  try {
    execSync("which which");
  } catch {
    console.log("⚙️ Đang cài 'which'...");
    execSync("pkg install -y which", { stdio: "inherit" });
  }

  try {
    execSync("which termux-wake-lock");
    exec("termux-wake-lock"); // 🔒 tránh sleep
  } catch {
    console.log("⚙️ Đang cài 'termux-api'...");
    execSync("pkg install -y termux-api", { stdio: "inherit" });
    exec("termux-wake-lock");
  }
}

// 🔐 Yêu cầu root
function ensureRoot() {
  try {
    const uid = execSync("id -u").toString().trim();
    if (uid !== "0") {
      const nodePath = execSync("which node").toString().trim();
      const scriptPath = __filename;
      console.log("🔐 Cần quyền root, đang chuyển qua su...");
      execSync(`su -c "${nodePath} ${scriptPath}"`, { stdio: "inherit" });
      process.exit(0);
    }
  } catch (err) {
    console.error("❌ Không thể chạy bằng root:", err.message);
    process.exit(1);
  }
}

// 📡 Lấy UserID từ username
async function getUserId(username) {
  try {
    const res = await axios.post("https://users.roblox.com/v1/usernames/users", {
      usernames: [username],
      excludeBannedUsers: false
    });
    return res.data?.data?.[0]?.id || null;
  } catch (err) {
    console.error("❌ Không lấy được user ID:", err.message);
    return null;
  }
}

// 👀 Xem user có đang trong game không
async function getPresence(userId) {
  try {
    const res = await axios.post("https://presence.roblox.com/v1/presence/users", {
      userIds: [userId]
    });
    return res.data.userPresences?.[0];
  } catch (err) {
    return null;
  }
}

// 🧼 Kill Roblox app
function killApp() {
  exec("am force-stop com.roblox.client");
}

// 🏁 Mở lại game
function launch(placeId, linkCode = null) {
  const url = linkCode
    ? `roblox://placeID=${placeId}&linkCode=${linkCode}`
    : `roblox://placeID=${placeId}`;
  exec(`am start -a android.intent.action.VIEW -d "${url}"`);
}

// 🔄 Kiểm tra app có đang chạy
function isRunning() {
  try {
    const pid = execSync("pidof com.roblox.client").toString().trim();
    return pid.length > 0;
  } catch {
    return false;
  }
}

// 🎮 List game
const GAMES = {
  "1": ["126884695634066", "Grow-a-Garden"],
  "2": ["2753915549", "Blox-Fruits"],
  "3": ["6284583030", "Pet-Simulator-X"],
  "4": ["126244816328678", "DIG"],
  "5": ["116495829188952", "Dead-Rails-Alpha"],
  "6": ["8737602449", "PLS-DONATE"],
  "0": ["custom", "🔧 Tùy chỉnh"]
};

// 🧠 Hỏi chọn game
async function chooseGame(rl) {
  console.log("🎮 Chọn game:");
  Object.keys(GAMES).forEach((key) => {
    console.log(`${key}. ${GAMES[key][1]} (${GAMES[key][0]})`);
  });

  const ans = await question(rl, "Nhập số: ");
  if (ans.trim() === "0") {
    const sub = await question(rl, "0.1 ID thủ công | 0.2 Link private: ");
    if (sub.trim() === "1") {
      const pid = await question(rl, "🔢 Nhập Place ID: ");
      return { placeId: pid.trim(), name: "Tùy chỉnh", linkCode: null };
    } else if (sub.trim() === "2") {
      const link = await question(rl, "🔗 Dán link private server: ");
      const match = link.match(/\/games\/(\d+).*privateServerLinkCode=([\w-]+)/);
      if (!match) throw new Error("❌ Link không hợp lệ!");
      return { placeId: match[1], name: "Private Server", linkCode: match[2] };
    } else throw new Error("❌ Không hợp lệ");
  } else if (GAMES[ans]) {
    return { placeId: GAMES[ans][0], name: GAMES[ans][1], linkCode: null };
  } else {
    throw new Error("❌ Không hợp lệ");
  }
}

// 🔁 Hỏi người dùng
function question(rl, msg) {
  return new Promise((resolve) => rl.question(msg, resolve));
}

// 🚀 Main
(async () => {
  ensureDeps();
  ensureBinaries();
  ensureRoot();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.clear();
  console.log("== Rejoin Tool (Node.js version) ==");

  const username = await question(rl, "👤 Nhập username Roblox: ");
  const userId = await getUserId(username.trim());

  if (!userId) {
    console.error("❌ Không tìm thấy user ID");
    rl.close();
    return;
  }
  console.log(`✅ User ID: ${userId}`);

  const game = await chooseGame(rl);
  const delayMin = parseInt(await question(rl, "⏱️ Delay check (phút): "));
  rl.close();

  const delayMs = Math.max(1, delayMin) * 60 * 1000;
  console.clear();
  console.log(`👤 ${username} | 🎮 ${game.name} (${game.placeId})`);
  console.log(`🔁 Auto-check mỗi ${delayMin} phút`);

  let isFirstCheck = true;

  while (true) {
    const presence = await getPresence(userId);
    let msg = "";

    if (isFirstCheck) {
      isFirstCheck = false;
      if (!presence || presence.userPresenceType !== 2) {
        console.log("🕒 User chưa online. Đang mở lại game...");
        killApp();
        launch(game.placeId, game.linkCode);
        await new Promise(r => setTimeout(r, 15000)); // ⏳ chờ 15s load app
        continue;
      }
    }

    if (!presence) {
      msg = "⚠️ Không lấy được trạng thái";
    } else if (presence.userPresenceType !== 2) {
      msg = "👋 User không online";
      killApp();
      launch(game.placeId, game.linkCode);
    } else if (`${presence.placeId}` !== `${game.placeId}`) {
      msg = `⚠️ Đang ở sai game (${presence.placeId})`;
      killApp();
      launch(game.placeId, game.linkCode);
    } else {
      msg = "✅ Đang đúng game rồi!";
    }

    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
})();
