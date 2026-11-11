#!/usr/bin/env bash
# Installs the host tools FFmpegKitNext's build scripts need ("Requirements Without Nix" on its wiki).
# Usage: install-host-packages.sh linux|macos
set -euo pipefail

case "${1:?linux or macos}" in
  linux)
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends \
      autoconf automake libtool pkg-config gettext autopoint \
      cmake bison meson ninja-build nasm yasm gperf ragel texinfo autogen \
      groff gtk-doc-tools libtasn1-6-dev tcl doxygen \
      gcc g++ make patch file findutils gawk rsync \
      python3 perl ruby curl wget git zip unzip xz-utils tar gzip sed grep diffutils \
      bash which
    ;;
  macos)
    brew install autoconf automake libtool pkg-config gettext \
      cmake bison meson ninja nasm yasm gperf ragel texinfo autogen \
      gtk-doc libtasn1 doxygen wget gnu-sed xz
    {
      echo "$(brew --prefix gettext)/bin"
      echo "$(brew --prefix bison)/bin"
      echo "$(brew --prefix texinfo)/bin"
    } >> "$GITHUB_PATH"
    {
      echo "ACLOCAL_PATH=$(brew --prefix gettext)/share/aclocal:$(brew --prefix)/share/aclocal"
      echo "SED=$(brew --prefix gnu-sed)/bin/gsed"
    } >> "$GITHUB_ENV"
    ;;
  *)
    echo "unknown host: $1" >&2
    exit 1
    ;;
esac
