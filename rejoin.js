#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

// ✅ Auto cài công cụ cần thiết
function ensureEnv() {
  const cmds = [
    ["which", "pkg install -y which"],
    ["termux-wake-lock", "termux-wake-lock"]
  ];

  cmds.forEach(([cmd, installCmd]) => {
    try {
      execSync(`command -v ${cmd}`);
    } catch {
      console.log(`📦 Cài ${cmd}...`);
      try {
        execSync(installCmd, { stdio: "inherit" });
      } catch (e) {
        console.error(`❌ Không cài được ${cmd}: ${e.message}`);
      }
    }
  });

  // ✅ Cài thư viện npm nếu chưa có
  const required = ["axios"];
  required.forEach((pkg) => {
    try {
      require.resolve(pkg);
    } catch {
      console.log(`📦 Đang cài thư viện npm: ${pkg}...`);
      execSync(`npm install ${pkg}`, { stdio: "inherit" });
    }
  });
}

// 🔐 Root nếu chưa có
function ensureRoot() {
  try {
    const uid = execSync("id -u").toString().trim();
    if (uid !== "0") {
      const nodePath = execSync("which node").toString().trim();
      const scriptPath = __filename;
      console.log("🔐 Yêu cầu root, đang chuyển qua su...");
      execSync(`su -c "${nodePath} ${scriptPath}"`, { stdio: "inherit" });
      process.exit(0);
    }
  } catch (err) {
    console.error("❌ Không thể chạy với root:", err.message);
    process.exit(1);
  }
}

// ==== PHẦN GỐC (giữ nguyên) ====

const axios = require("axios");
const readline = require("readline");

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

// 🚀 MAIN
(async () => {
  ensureEnv();
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

  while (true) {
    const presence = await getPresence(userId);
    let msg = "";
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
