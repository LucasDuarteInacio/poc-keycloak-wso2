#!/usr/bin/env zsh

set -euo pipefail

usage() {
  cat <<'EOF'
Uso:
  source backend/scripts/switch-java-zsh.sh <versao> [--persist]

Exemplos:
  source backend/scripts/switch-java-zsh.sh 17
  source backend/scripts/switch-java-zsh.sh 21 --persist
  source backend/scripts/switch-java-zsh.sh 25 --persist

Detalhes:
  - Sem --persist: altera apenas a sessão atual do shell.
  - Com --persist: grava JAVA_HOME e PATH no ~/.zshrc.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 ]]; then
  usage
  return 0 2>/dev/null || exit 0
fi

requested_version="$1"
persist_flag="${2:-}"

if ! [[ "$requested_version" =~ '^[0-9]+$' ]]; then
  echo "Erro: versão inválida '$requested_version'. Use apenas números (ex.: 17, 21, 25)." >&2
  return 1 2>/dev/null || exit 1
fi

if [[ -x "/usr/libexec/java_home" ]]; then
  if java_home_candidate=$(/usr/libexec/java_home -v "$requested_version" 2>/dev/null); then
    export JAVA_HOME="$java_home_candidate"
  else
    echo "Erro: Java $requested_version não encontrado via /usr/libexec/java_home." >&2
    echo "Dica: instale a versão e rode novamente." >&2
    return 1 2>/dev/null || exit 1
  fi
else
  echo "Erro: /usr/libexec/java_home não está disponível neste sistema." >&2
  return 1 2>/dev/null || exit 1
fi

export PATH="$JAVA_HOME/bin:${PATH}"

echo "JAVA_HOME atualizado para: $JAVA_HOME"
java -version

if [[ "$persist_flag" == "--persist" ]]; then
  zshrc_file="$HOME/.zshrc"
  begin_marker="# >>> java-switcher >>>"
  end_marker="# <<< java-switcher <<<"

  mkdir -p "$HOME"
  touch "$zshrc_file"

  # Remove bloco anterior, se existir.
  if command -v awk >/dev/null 2>&1; then
    awk -v begin="$begin_marker" -v end="$end_marker" '
      $0 == begin { skip=1; next }
      $0 == end { skip=0; next }
      !skip { print }
    ' "$zshrc_file" > "${zshrc_file}.tmp"
    mv "${zshrc_file}.tmp" "$zshrc_file"
  fi

  {
    echo ""
    echo "$begin_marker"
    echo "export JAVA_HOME=\"$JAVA_HOME\""
    echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\""
    echo "$end_marker"
  } >> "$zshrc_file"

  echo "Configuração persistida em $zshrc_file."
  echo "Abra um novo terminal ou rode: source ~/.zshrc"
fi
