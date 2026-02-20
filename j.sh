#!/bin/bash
# j shell wrapper - source this file in your .zshrc or .bashrc

j() {
  # Find the directory where this script is located
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local cd_file="$HOME/.local/share/j/.j_cd"

  # Clean up any previous cd file
  rm -f "$cd_file"

  # Run the j.js script with all arguments
  node "$script_dir/j.js" "$@"

  # If j.js set a directory to change to, do it
  if [[ -f "$cd_file" ]]; then
    cd "$(cat "$cd_file")"
    rm -f "$cd_file"
    pwd
  fi
}
