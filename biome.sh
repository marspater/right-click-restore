#!/bin/bash
set -e

# Always resolve to the project directory containing this script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

ACTION="${1:-check}"

case "$ACTION" in
  check)
    npx @biomejs/biome check --config-path="$DIR" "$DIR"
    ;;
  check:write|fix)
    npx @biomejs/biome check --write --config-path="$DIR" "$DIR"
    ;;
  format|fmt)
    npx @biomejs/biome format --write --config-path="$DIR" "$DIR"
    ;;
  lint)
    npx @biomejs/biome lint --config-path="$DIR" "$DIR"
    ;;
  *)
    echo "Usage: ./biome.sh [check | fix | format | lint]"
    exit 1
    ;;
esac
