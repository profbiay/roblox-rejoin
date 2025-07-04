const axios = require('axios');
const readline = require('readline-sync');
const { execSync } = require('child_process');

// ========================
// 💥 Su wrapper
// ========================
function su(cmd) {
  try {
    return execSync(`su -c "${cmd}"`).toString().trim();
  } catch (err) {
    console.error(`❌ Lệnh lỗi (su): ${cmd}`);
    process.exit(1);
  }
}

// ========================
// 🔐 Check root (hard rule)
// ========================
function mustBeRoot() {
  const output = su("id");
  if (!output.includes("uid=0")) {
    console.error("❌ Thiết bị chưa root hoặc không chạy dưới su.");
    process.exit(1);
  }
}

// ========================
// 🎮 Game list
// ========================
const GAMES = {
  "1": ["126884695634066", "Grow-a-Garden"],
  "2": ["2753915549", "Blox-Fruits"],
  "3": ["6284583030", "Pet-Simulator-X"],
  "4": ["126244816328678", "DIG"],
  "5": ["116495829188952", "Dead-Rails-Alpha"],
  "6": ["8737602449", "PLS-DONATE"],
  "0": ["custom", "🔧 Khác"]
};

// ========================
// 📡 Roblox APIs
// ========================
async function getUserId(username) {
  const res = await axios.get(`https://api.roblox.com/users/get-by-username?username=${username}`);
  return res.data?.Id || null;
}

async function getPresence(userId) {
  const res = await axios.post(
    "https://presence.roblox.com/v1/presence/users",
    { userIds: [userId] },
    { headers: { 'Content-Type': 'application/json' } }
  );
  const data = res.data.userPresences[0];
  return [data.userPresenceType, data.placeId];
}

// ========================
// ⚙️ Device actions
// ========================
function isRobloxRunning() {
  return su("pidof com.roblox.client") !== '';
}

function killRoblox() {
  su("am force-stop com.roblox.client");
}

function launchGame(placeId, linkCode) {
  const url = linkCode
    ? `roblox://placeID=${placeId}&linkCode=${linkCode}`
    : `roblox://placeID=${placeId}`;
  su(`am start -a android.intent.action.VIEW -d '${url}'`);
}

// ========================
// 🕹️ Game picker
// ========================
function chooseGame() {
  console.clear();
  console.log("🎮 Chọn game để vào:");
  for (const [key, [id, name]] of Object.entries(GAMES)) {
    console.log(`${key}. ${name} (${id})`);
  }

  const choice = readline.question("Nhập số: ").trim();

  if (choice === "0") {
    console.log("\n0.1: Nhập ID game thủ công");
    console.log("0.2: Nhập link private server");
    const sub = readline.question("Chọn kiểu: ").trim();

    if (sub === "1") {
      const pid = readline.question("🔢 Nhập Place ID: ").trim();
      return [pid, "Tùy chỉnh", null];
    } else if (sub === "2") {
      const link = readline.question("🔗 Dán link private: ").trim();
      const match = link.match(/\/games\/(\d+).*?privateServerLinkCode=([\w-]+)/);
      if (match) return [match[1], "Private Server", match[2]];
      console.error("❌ Link không hợp lệ.");
      process.exit(1);
    } else {
      console.error("❌ Lựa chọn không hợp lệ.");
      process.exit(1);
    }
  } else if (GAMES[choice]) {
    return [...GAMES[choice], null];
  } else {
    console.error("❌ Lựa chọn không hợp lệ.");
    process.exit(1);
  }
}

// ========================
// 🚀 MAIN
// ========================
async function main() {
  mustBeRoot();

  console.clear();
  console.log("== Rejoin Tool (Node.js su version) ==");

  const username = readline.question("👤 Nhập username Roblox: ").trim();
  const userId = await getUserId(username);
  if (!userId) {
    console.error("❌ Username không tồn tại.");
    return;
  }

  const [placeId, gameName, linkCode] = chooseGame();
  let delay = parseInt(readline.question("⏱️ Check mỗi bao nhiêu phút (1-60)? ").trim());
  delay = Math.max(1, Math.min(60, delay)) * 60 * 1000;

  console.clear();
  console.log(`👤 Username: ${username}\n🎮 Game: ${gameName} (${placeId})\n🔁 Check mỗi ${delay / 60000} phút\n`);

  while (true) {
    const [presence, currentPlace] = await getPresence(userId);

    let status = "";
    if (presence === null) {
      status = "❌ Không kết nối API";
    } else if (presence !== 2) {
      status = "⚠️ Offline / ngoài game";
      if (isRobloxRunning()) killRoblox();
      launchGame(placeId, linkCode);
    } else if (String(currentPlace) !== String(placeId)) {
      status = `⚠️ Sai game (${currentPlace})`;
      killRoblox();
      launchGame(placeId, linkCode);
    } else {
      status = "✅ Đúng game";
    }

    process.stdout.write(`\r[${new Date().toLocaleTimeString()}] ${username} | ${status}     `);
    await new Promise((r) => setTimeout(r, delay));
  }
}

main();
