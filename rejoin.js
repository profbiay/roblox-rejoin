#!/usr/bin/env node

const axios = require('axios');
const { execSync, exec } = require('child_process');
const readline = require('readline');

// ========================
// 🔐 Bắt buộc root
// ========================
function ensureRoot() {
  try {
    // Nếu uid !== 0, re‐exec với su
    const uid = execSync('id -u').toString().trim();
    if (uid !== '0') {
      console.log('🔐 Cần quyền root, đang tự động chuyển...');
      execSync(`su -c "node ${__filename}"`, { stdio: 'inherit' });
      process.exit(0);
    }
  } catch (e) {
    console.error('❌ Không thể kiểm tra quyền root:', e.message);
    process.exit(1);
  }
}

// ========================
// 📡 API Roblox
// ========================
async function getUserId(username) {
  const url = 'https://users.roblox.com/v1/usernames/users';
  const body = { usernames: [username], excludeBannedUsers: false };

  try {
    const res = await axios.post(url, body);
    return res.data.data[0]?.id || null;
  } catch (e) {
    console.error('❌ Lỗi khi gọi API lấy User ID:', e.message);
    return null;
  }
}

async function getPresence(userId) {
  const url = 'https://presence.roblox.com/v1/presence/users';
  const body = { userIds: [userId] };

  try {
    const res = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    const p = res.data.userPresences[0];
    return { type: p.userPresenceType, placeId: p.placeId };
  } catch (e) {
    return null;
  }
}

// ========================
// 🕹️ Game list & picker
// ========================
const GAMES = {
  "1": ["126884695634066", "Grow-a-Garden"],
  "2": ["2753915549",   "Blox-Fruits"],
  "3": ["6284583030",   "Pet-Simulator-X"],
  "4": ["126244816328678","DIG"],
  "5": ["116495829188952","Dead-Rails-Alpha"],
  "6": ["8737602449",   "PLS-DONATE"],
  "0": ["custom",       "🔧 Khác (tùy chọn)"]
};

function chooseGame(rl) {
  console.clear();
  console.log("🎮 Chọn game để auto-rejoin:");
  for (let k in GAMES) {
    console.log(`${k}. ${GAMES[k][1]} (${GAMES[k][0]})`);
  }
  return new Promise(resolve => {
    rl.question("Nhập số: ", choice => {
      choice = choice.trim();
      if (choice === "0") {
        rl.question("0.1 ID thủ công | 0.2 Link private: ", sub => {
          sub = sub.trim();
          if (sub === "1") {
            rl.question("🔢 Nhập Place ID: ", pid => {
              resolve({ placeId: pid.trim(), name: "Tùy chỉnh", linkCode: null });
            });
          } else if (sub === "2") {
            rl.question("🔗 Dán link private server: ", link => {
              const m = link.match(/\/games\/(\d+).*privateServerLinkCode=([\w-]+)/);
              if (!m) return process.exit(console.error("❌ Link không hợp lệ."));
              resolve({ placeId: m[1], name: "Private Server", linkCode: m[2] });
            });
          } else {
            process.exit(console.error("❌ Lựa chọn không hợp lệ."));
          }
        });
      } else if (GAMES[choice]) {
        const [pid,name] = GAMES[choice];
        resolve({ placeId: pid, name, linkCode: null });
      } else {
        process.exit(console.error("❌ Lựa chọn không hợp lệ."));
      }
    });
  });
}

// ========================
// 🔄 Rejoin logic
// ========================
function isRunning() {
  try {
    return execSync('pidof com.roblox.client').toString().trim() !== '';
  } catch { return false; }
}

function killApp() {
  exec('am force-stop com.roblox.client', () => {});
}

function launch(placeId, linkCode) {
  const uri = linkCode
    ? `roblox://placeID=${placeId}&linkCode=${linkCode}`
    : `roblox://placeID=${placeId}`;
  exec(`am start -a android.intent.action.VIEW -d "${uri}"`);
}

// ========================
// 🚀 Main
// ========================
(async () => {
  ensureRoot();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.clear();
  console.log("== Rejoin Tool (Node.js) ==");
  const username = await new Promise(res => rl.question("👤 Nhập username Roblox: ", res));
  const userId = await getUserId(username.trim());
  if (!userId) {
    console.error("❌ Không tìm thấy User ID.");
    rl.close();
    return;
  }
  console.log(`✅ User ID: ${userId}`);

  const { placeId, name, linkCode } = await chooseGame(rl);
  const delayMin = await new Promise(res => rl.question("⏱️ Check mỗi bao nhiêu phút (1-60): ", res));
  rl.close();

  let delay = parseInt(delayMin);
  delay = Math.max(1, Math.min(60, delay)) * 60 * 1000;

  console.clear();
  console.log(`👤 ${username} | 🎮 ${name} (${placeId}) | 🔁 Check mỗi ${delay/60000} phút`);

  while (true) {
    const p = await getPresence(userId);
    let status = "";
    if (!p) {
      status = "⚠️ Lỗi kết nối API";
    } else if (p.type !== 2) {
      status = "❌ Offline / ngoài game";
      if (isRunning()) killApp();
      launch(placeId, linkCode);
    } else if (`${p.placeId}` !== `${placeId}`) {
      status = `⚠️ Sai game (${p.placeId})`;
      killApp();
      launch(placeId, linkCode);
    } else {
      status = "✅ Đang ở đúng game";
    }
    process.stdout.write(`\r[${new Date().toLocaleTimeString()}] ${status}     `);
    await new Promise(r => setTimeout(r, delay));
  }
})();
