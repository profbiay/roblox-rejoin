const axios = require('axios');
const readline = require('readline-sync');
const { execSync, exec } = require('child_process');

// ========================
// 💥 Force chạy bằng su
// ========================
try {
  const uid = execSync('id -u').toString().trim();
  if (uid !== '0') {
    console.log('🔐 Cần quyền root (su) để chạy script này.');
    console.log('👉 Đang chuyển sang chạy bằng su...');
    execSync(`su -c "node ${__filename}"`, { stdio: 'inherit' });
    process.exit();
  }
} catch (e) {
  console.error('❌ Không thể chuyển sang su:', e.message);
  process.exit(1);
}

// ========================
// 📦 Data game
// ========================
const GAMES = {
  "1": ["126884695634066", "Grow-a-Garden"],
  "2": ["2753915549", "Blox-Fruits"],
  "3": ["6284583030", "Pet-Simulator-X"],
  "4": ["126244816328678", "DIG"],
  "5": ["116495829188952", "Dead-Rails-Alpha"],
  "6": ["8737602449", "PLS-DONATE"],
  "0": ["custom", "🔧 Khác (tùy chọn)"]
};

// ========================
// 🧠 Hàm phụ
// ========================
async function getUserId(username) {
  const url = 'https://users.roblox.com/v1/usernames/users';
  const body = {
    usernames: [username],
    excludeBannedUsers: false
  };
  try {
    const res = await axios.post(url, body);
    return res.data.data[0]?.id || null;
  } catch (e) {
    return null;
  }
}

async function getUserPresence(userId) {
  try {
    const res = await axios.post(
      'https://presence.roblox.com/v1/presence/users',
      { userIds: [userId] },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const presence = res.data.userPresences[0];
    return {
      presenceType: presence.userPresenceType,
      placeId: presence.placeId
    };
  } catch {
    return null;
  }
}

function chooseGame() {
  console.clear();
  console.log("🎮 Chọn game để vào:");
  Object.entries(GAMES).forEach(([key, [id, name]]) => {
    console.log(`${key}. ${name} (${id})`);
  });

  const choice = readline.question("Nhập số: ").trim();

  if (choice === "0") {
    const sub = readline.question("0.1: Nhập ID game | 0.2: Nhập link private server: ").trim();
    if (sub === "1") {
      const pid = readline.question("🔢 Nhập Place ID: ");
      return { placeId: pid, name: "Tùy chỉnh", linkCode: null };
    } else if (sub === "2") {
      const link = readline.question("🔗 Nhập link: ");
      const match = link.match(/\/games\/(\d+).*privateServerLinkCode=([\w-]+)/);
      if (!match) {
        console.log("❌ Link không hợp lệ!");
        process.exit(1);
      }
      return { placeId: match[1], name: "Private Server", linkCode: match[2] };
    } else {
      console.log("❌ Không hợp lệ.");
      process.exit(1);
    }
  }

  if (!GAMES[choice]) {
    console.log("❌ Không hợp lệ.");
    process.exit(1);
  }

  return { placeId: GAMES[choice][0], name: GAMES[choice][1], linkCode: null };
}

function isRobloxRunning() {
  try {
    const pid = execSync('pidof com.roblox.client').toString().trim();
    return pid !== '';
  } catch {
    return false;
  }
}

function killRoblox() {
  try {
    execSync('am force-stop com.roblox.client');
  } catch (e) {
    console.log("❌ Không thể force-stop Roblox:", e.message);
  }
}

function launchGame(placeId, linkCode) {
  const link = linkCode
    ? `roblox://placeID=${placeId}&linkCode=${linkCode}`
    : `roblox://placeID=${placeId}`;
  exec(`am start -a android.intent.action.VIEW -d "${link}"`);
}

function printStatus(username, status) {
  process.stdout.write(`\r== Rejoin Tool == | 👤 ${username} | 📊 ${status}     `);
  process.stdout.flush();
}

// ========================
// 🚀 MAIN
// ========================
async function main() {
  console.clear();
  console.log("== Rejoin Tool (Node.js su version) ==");
  const username = readline.question("👤 Nhập username Roblox: ").trim();
  const userId = await getUserId(username);

  if (!userId) {
    console.log("❌ Không tìm thấy user!");
    return;
  }

  const { placeId, name, linkCode } = chooseGame();
  let delay = parseInt(readline.question("⏱️ Check mỗi bao nhiêu phút? (1-60): "));
  delay = Math.max(1, Math.min(delay, 60)) * 60 * 1000;

  console.clear();
  console.log(`== Rejoin Tool ==\n👤 ${username}\n🎮 Game: ${name} (${placeId})\n🔁 Check mỗi ${delay / 60000} phút\n`);

  while (true) {
    const presence = await getUserPresence(userId);

    if (!presence) {
      printStatus(username, "🌐 Lỗi kết nối API");
    } else if (presence.presenceType !== 2) {
      printStatus(username, "❌ Offline hoặc chưa vào game");
      if (isRobloxRunning()) killRoblox();
      launchGame(placeId, linkCode);
    } else if (`${presence.placeId}` !== `${placeId}`) {
      printStatus(username, `⚠️ Sai game (${presence.placeId})`);
      killRoblox();
      launchGame(placeId, linkCode);
    } else {
      printStatus(username, "✅ Đúng game");
    }

    await new Promise(r => setTimeout(r, delay));
  }
}

main();
