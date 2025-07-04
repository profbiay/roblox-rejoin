import os
import time
import requests
import re
import sys
import subprocess

# ========================== #
# 🚫 Check quyền force-stop
# ========================== #
def check_force_stop_permission():
    test_cmd = "am force-stop com.roblox.client"
    try:
        result = subprocess.run(test_cmd.split(), stderr=subprocess.PIPE, stdout=subprocess.PIPE, timeout=2)
        output = result.stderr.decode() + result.stdout.decode()
        if "Permission denied" in output or "not allowed" in output or "SecurityException" in output:
            print("❌ Thiết bị của bạn không cho phép dùng 'am force-stop'.")
            print("👉 Cần root hoặc chạy từ ADB shell để tiếp tục.")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Lỗi khi kiểm tra quyền force-stop: {e}")
        sys.exit(1)

# ========================== #
# 🎮 Game List
# ========================== #
GAMES = {
    "1": ("126884695634066", "Grow-a-Garden"),
    "2": ("2753915549", "Blox-Fruits"),
    "3": ("6284583030", "Pet-Simulator-X"),
    "4": ("126244816328678", "DIG"),
    "5": ("116495829188952", "Dead-Rails-Alpha"),
    "6": ("8737602449", "PLS-DONATE"),
    "0": ("custom", "🔧 Khác (tùy chọn)")
}

# ========================== #
# 🎮 Chọn game
# ========================== #
def choose_game():
    os.system("clear")
    print("🎮 Chọn game để vào:")
    for key, (id, name) in GAMES.items():
        print(f"{key}. {name} ({id})")
    choice = input("Nhập số: ").strip()

    if choice == "0":
        print("\n0.1: Nhập ID game thủ công")
        print("0.2: Nhập link server riêng (private server)")
        sub_choice = input("Chọn kiểu: ").strip()

        if sub_choice == "1":
            place_id = input("🔢 Nhập Place ID: ").strip()
            return place_id, "Tùy chỉnh (ID thủ công)", None
        elif sub_choice == "2":
            link = input("🔗 Dán link private server: ").strip()
            match = re.search(r'/games/(\d+)/.*[?&]privateServerLinkCode=([\w-]+)', link)
            if match:
                place_id, link_code = match.groups()
                return place_id, "Private Server", link_code
            else:
                print("❌ Link không hợp lệ!")
                sys.exit(1)
        else:
            print("❌ Lựa chọn không hợp lệ.")
            sys.exit(1)
    elif choice in GAMES:
        return GAMES[choice][0], GAMES[choice][1], None
    else:
        print("❌ Lựa chọn không hợp lệ.")
        sys.exit(1)

# ========================== #
# 🔎 Get User Info
# ========================== #
def get_user_info(username):
    url = f"https://api.roblox.com/users/get-by-username?username={username}"
    res = requests.get(url)
    if res.status_code != 200:
        return None
    return res.json().get('Id')

# ========================== #
# 🔍 Check trạng thái Roblox
# ========================== #
def get_user_presence(user_id):
    url = "https://presence.roblox.com/v1/presence/users"
    payload = {"userIds": [user_id]}
    headers = {'Content-Type': 'application/json'}
    try:
        res = requests.post(url, json=payload, headers=headers)
        if res.status_code != 200:
            return None, None
        data = res.json()["userPresences"][0]
        return data.get("userPresenceType"), data.get("placeId")
    except:
        return None, None

def is_roblox_running():
    result = os.popen("pidof com.roblox.client").read().strip()
    return result != ""

def kill_roblox():
    os.system("am force-stop com.roblox.client")

def launch_game(place_id, link_code=None):
    if link_code:
        url = f"roblox://placeID={place_id}&linkCode={link_code}"
    else:
        url = f"roblox://placeID={place_id}"
    os.system(f"am start -a android.intent.action.VIEW -d \"{url}\"")

def clear():
    os.system("clear")

def print_status(username, status):
    sys.stdout.write(f"\r==Rejoin Tool== | Username: {username} | Trạng thái: {status}     ")
    sys.stdout.flush()

# ========================== #
# 🧠 MAIN PROGRAM
# ========================== #
def main():
    check_force_stop_permission()  # Kiểm tra root/adb
    clear()
    print("==Rejoin Tool==")
    username = input("👤 Nhập username Roblox: ").strip()
    user_id = get_user_info(username)
    if not user_id:
        print("❌ Username không tồn tại!")
        return

    place_id, game_name, link_code = choose_game()
    delay = int(input("⏱️ Check mỗi bao nhiêu phút? (1-60): ").strip())
    delay = max(1, min(60, delay)) * 60

    clear()
    print(f"==Rejoin Tool==\n👤 Username: {username}\n🎮 Game: {game_name} ({place_id})\n🔁 Kiểm tra mỗi {delay//60} phút\n")

    while True:
        presence, current_place = get_user_presence(user_id)

        if presence is None:
            print_status(username, "Không thể kết nối API Roblox")
        elif presence != 2:
            print_status(username, "❌ Offline / không trong game")
            if is_roblox_running():
                kill_roblox()
            launch_game(place_id, link_code)
        elif str(current_place) != str(place_id):
            print_status(username, f"⚠️ Đang ở sai game ({current_place})")
            kill_roblox()
            launch_game(place_id, link_code)
        else:
            print_status(username, "✅ Đang trong đúng game")

        time.sleep(delay)

# ========================== #
# 🚀 Run
# ========================== #
if __name__ == "__main__":
    main()
