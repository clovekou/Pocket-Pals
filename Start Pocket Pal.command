#!/bin/bash
# Double-click this file (macOS) to start Pocket Pal's local server and open the dashboard.
# Keep this window open while you use the dashboard; close it (or press Ctrl+C) to stop.
cd "$(dirname "$0")" || exit 1
PORT=8000
if curl -s -o /dev/null "http://localhost:$PORT/api/state"; then
  echo "Pocket Pal is already running."
  open "http://localhost:$PORT/dashboard.html"
  exit 0
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed. Install it from https://www.python.org/downloads/ and try again."
  read -r -p "Press Enter to close." _
  exit 1
fi
(sleep 2; open "http://localhost:$PORT/dashboard.html") &
python3 server.py "$PORT"
