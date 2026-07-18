#!/bin/bash

# Function to clean up background servers on exit
cleanup() {
    echo -e "\nShutting down Aperture servers..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    exit 0
}

# Trap Ctrl+C (SIGINT) and termination signals
trap cleanup SIGINT SIGTERM

# Absolute path resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Aperture Backend..."
export PYTHONPATH="$SCRIPT_DIR"
source "$SCRIPT_DIR/backend/.venv/bin/activate"
uvicorn backend.main:app --port 8000 --reload &
BACKEND_PID=$!

echo "Starting Aperture Frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo -e "\nServers launched. Access the app at http://localhost:3000"
echo "Press Ctrl+C to terminate both servers."

# Wait 3 seconds for servers to initialize, then open default browser (macOS)
(sleep 3 && open http://localhost:3000) &

# Wait for background servers
wait
