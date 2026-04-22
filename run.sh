#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="roulette-gui"
PORT="4173"
NODE_MAJOR="20"

USER_NAME="${SUDO_USER:-$USER}"
ARCH="$(dpkg --print-architecture)"

if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "ERROR: run this script from the project root where package.json exists"
  exit 1
fi

echo "[1/11] Base packages..."
sudo apt update
sudo apt install -y curl ca-certificates gnupg build-essential

echo "[2/11] Install Node.js ${NODE_MAJOR}.x from NodeSource if needed..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "[3/11] Versions..."
node -v
npm -v

echo "[4/11] Clean old install..."
cd "$APP_DIR"
rm -rf node_modules

echo "[5/11] Install deps..."
npm install

echo "[6/11] Tailwind oxide workaround if needed..."
case "$ARCH" in
  arm64)
    npm install -D @tailwindcss/oxide-linux-arm64-gnu lightningcss-linux-arm64-gnu || true
    ;;
  amd64)
    npm install -D @tailwindcss/oxide-linux-x64-gnu lightningcss-linux-x64-gnu || true
    ;;
  armhf)
    echo "WARN: armhf is not a common target for this stack; skipping manual oxide package"
    ;;
  *)
    echo "WARN: unknown arch '$ARCH', skipping manual oxide package"
    ;;
esac

echo "[7/11] Build app..."
npm run build

echo "[8/11] Create runner..."
mkdir -p "$APP_DIR/scripts"
cat > "$APP_DIR/scripts/run-server.sh" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
cd "$APP_DIR"
export NODE_ENV=production
export PORT=$PORT
exec npm run start
EOF
chmod +x "$APP_DIR/scripts/run-server.sh"

echo "[9/11] Create systemd service..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service >/dev/null <<EOF
[Unit]
Description=Roulette GUI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/scripts/run-server.sh
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=$PORT

[Install]
WantedBy=multi-user.target
EOF

echo "[10/11] Open firewall port if UFW is enabled..."
if command -v ufw >/dev/null 2>&1; then
  UFW_STATUS="$(sudo ufw status | head -n1 || true)"
  if echo "$UFW_STATUS" | grep -qi "active"; then
    sudo ufw allow ${PORT}/tcp
  fi
fi

echo "[11/11] Enable and restart service..."
sudo systemctl daemon-reload
sudo systemctl enable --now ${SERVICE_NAME}.service
sudo systemctl restart ${SERVICE_NAME}.service

sleep 2

IP_ADDR="$(hostname -I | awk '{print $1}')"

echo
echo "READY"
echo "LAN URL:      http://${IP_ADDR}:${PORT}"
echo "LOCAL URL:    http://127.0.0.1:${PORT}"
echo "STATUS:       sudo systemctl status ${SERVICE_NAME}.service"
echo "LOGS:         sudo journalctl -u ${SERVICE_NAME}.service -f"
echo "RESTART:      sudo systemctl restart ${SERVICE_NAME}.service"
