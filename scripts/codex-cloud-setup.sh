#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

DOTNET_CHANNEL="${DOTNET_CHANNEL:-10.0}"
DOTNET_INSTALL_DIR="${DOTNET_INSTALL_DIR:-$HOME/.dotnet}"
DOTNET_BIN="$DOTNET_INSTALL_DIR/dotnet"
BASHRC_FILE="${HOME}/.bashrc"

log() {
    printf '\n[%s] %s\n' "codex-setup" "$1"
}

append_if_missing() {
    local line="$1"
    local file="$2"

    touch "$file"

    if ! grep -Fqx "$line" "$file"; then
        printf '%s\n' "$line" >> "$file"
    fi
}

ensure_dotnet_10() {
    if [ -x "$DOTNET_BIN" ] && "$DOTNET_BIN" --list-sdks | grep -q '^10\.'; then
        log ".NET 10 SDK already present in $DOTNET_INSTALL_DIR"
        return
    fi

    log "Installing .NET SDK channel ${DOTNET_CHANNEL}"

    local installer
    installer="$(mktemp)"

    curl -fsSL https://dot.net/v1/dotnet-install.sh -o "$installer"
    bash "$installer" \
        --channel "$DOTNET_CHANNEL" \
        --install-dir "$DOTNET_INSTALL_DIR" \
        --no-path

    rm -f "$installer"
}

persist_dotnet_path() {
    append_if_missing 'export DOTNET_ROOT="$HOME/.dotnet"' "$BASHRC_FILE"
    append_if_missing 'export PATH="$HOME/.dotnet:$HOME/.dotnet/tools:$PATH"' "$BASHRC_FILE"

    export DOTNET_ROOT="$DOTNET_INSTALL_DIR"
    export PATH="$DOTNET_INSTALL_DIR:$DOTNET_INSTALL_DIR/tools:$PATH"
}

restore_webapi() {
    log "Restoring and building Web API"
    dotnet restore "$PROJECT_ROOT/webapi/EFCorePerf.Api/EFCorePerf.Api.csproj"
    dotnet build "$PROJECT_ROOT/webapi/EFCorePerf.Api/EFCorePerf.Api.csproj" --no-restore
}

restore_dashboard() {
    if ! command -v node >/dev/null 2>&1; then
        log "Node.js is not installed. Pin Node.js 20 in Codex preinstalled packages."
        exit 1
    fi

    log "Installing dashboard dependencies"
    (
        cd "$PROJECT_ROOT/dashboard"
        npm ci
    )
}

main() {
    log "Preparing EF Core Bench Lab for Codex Cloud"
    log "This will install .NET 10 and warm the repo so the agent has fewer excuses."

    ensure_dotnet_10
    persist_dotnet_path

    log "Using dotnet from $(command -v dotnet)"
    dotnet --info | sed -n '1,20p'

    restore_webapi
    restore_dashboard

    log "Setup complete"
}

main "$@"
