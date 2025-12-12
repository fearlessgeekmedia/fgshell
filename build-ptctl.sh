#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Compiling ptctl C extension..."
gcc -shared -fPIC -o libptctl.so src/ptctl.c

echo "✓ Compiled libptctl.so"
ls -lh libptctl.so
