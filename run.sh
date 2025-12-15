#!/bin/bash
# promptbox.pro - Start Script (macOS/Linux)

set -e

API_PORT=${API_PORT:-8000}
UI_PORT=${UI_PORT:-5173}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${CYAN}  ⑂ PROMPTBOX.PRO${NC}"
    echo -e "${GRAY}  Agent Orchestration Command Center${NC}"
    echo ""
}

start_api() {
    echo -e "${YELLOW}Starting API server on port $API_PORT...${NC}"

    # Check for Python
    if command -v python3 &> /dev/null; then
        PYTHON=python3
    elif command -v python &> /dev/null; then
        PYTHON=python
    else
        echo -e "${RED}Error: Python not found. Please install Python 3.8+${NC}"
        exit 1
    fi

    # Create venv if needed
    if [ ! -d "venv" ]; then
        echo -e "${GRAY}Creating virtual environment...${NC}"
        $PYTHON -m venv venv
    fi

    # Activate and install deps
    source venv/bin/activate
    pip install -q -r requirements.txt

    # Start API
    uvicorn api.main:app --host 0.0.0.0 --port $API_PORT --reload
}

start_ui() {
    echo -e "${YELLOW}Starting UI server on port $UI_PORT...${NC}"

    # Check for npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm not found. Please install Node.js${NC}"
        exit 1
    fi

    # Install deps if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${GRAY}Installing npm dependencies...${NC}"
        npm install
    fi

    # Start UI
    npm run dev -- --port $UI_PORT
}

start_both() {
    echo -e "${GREEN}Starting both API and UI servers...${NC}"
    echo ""
    echo -e "${GRAY}To start only one service, use:${NC}"
    echo -e "${GRAY}  ./run.sh api    # Start API only${NC}"
    echo -e "${GRAY}  ./run.sh ui     # Start UI only${NC}"
    echo ""

    # Start API in background
    (
        source venv/bin/activate 2>/dev/null || {
            python3 -m venv venv
            source venv/bin/activate
            pip install -q -r requirements.txt
        }
        uvicorn api.main:app --host 0.0.0.0 --port $API_PORT --reload
    ) &
    API_PID=$!

    echo -e "${CYAN}API server starting in background (PID: $API_PID)...${NC}"

    # Give API time to start
    sleep 2

    # Start UI in foreground (will also handle Ctrl+C)
    trap "kill $API_PID 2>/dev/null" EXIT
    start_ui
}

print_header

case "${1:-both}" in
    api)
        start_api
        ;;
    ui)
        start_ui
        ;;
    both|"")
        start_both
        ;;
    *)
        echo "Usage: $0 [api|ui|both]"
        exit 1
        ;;
esac
