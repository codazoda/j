# Plan: `j` — BBS-Style Menu CLI

## Context

Replace the aliases and functions in `~/.zshrc` with a single interactive menu tool. Type `j` + Enter, then navigate with single keypresses — no Enter between menus. Two keystrokes reach any command (e.g., `gc` = git commit, `ff` = find file). BBS-style colored display, JSON-configured menus, installable from GitHub like peen.

## File Structure

```
j.js          — All application logic (single file)
menus.json    — Menu tree configuration
package.json  — ES module config + build script
install.sh    — Remote installer (curl | bash)
VERSION       — "0.1.0"
```

## Platform Support

Must work on macOS, Linux, and Windows (WSL). A `platform()` helper detects the environment:
- **macOS**: `process.platform === "darwin"`
- **WSL**: `process.platform === "linux"` + `/proc/version` contains "microsoft" or "WSL"
- **Linux**: `process.platform === "linux"` (and not WSL)

Platform-specific behavior:
| Feature | macOS | Linux | WSL |
|---|---|---|---|
| Clipboard copy | `pbcopy` | `xclip -selection clipboard` | `clip.exe` |
| Clipboard paste | `pbpaste` | `xclip -selection clipboard -o` | `powershell.exe -c Get-Clipboard` |
| Shell config | `~/.zshrc` | `~/.bashrc` (or `~/.zshrc` if zsh) | `~/.bashrc` (or `~/.zshrc`) |
| Shell used | `/bin/bash` | `/bin/bash` | `/bin/bash` |

The install auto-detects which RC file to append the `source` line to: checks `$SHELL` — if it ends in `zsh`, use `~/.zshrc`; otherwise `~/.bashrc`.

## Architecture

### `j.js` — Single-file Node.js ES module, no npm dependencies

**Sections:**
1. **Imports & ANSI constants** — `child_process`, `fs`, `readline`, `path`, `os`. Color codes: red `\x1b[31m`, yellow `\x1b[33m`, reset `\x1b[0m`.
2. **`detectPlatform()`** — Returns `"macos"`, `"wsl"`, or `"linux"`. Used by clipboard builtins and install.
3. **`loadMenus()`** — Read `menus.json` from same dir via `import.meta.url`.
4. **`filterByMode(menus, mode)`** — Filter items by `J_MODE` env var. Items without a `modes` array always show.
5. **`renderMenu(menuKey, menus)`** — Clear screen. Center title `--- Title ---` (red dashes, yellow text). Render items in 4 columns × 18 chars, centered on terminal width. Items show `(K)label` with yellow key letter.
6. **Keystroke handler** — `process.stdin.setRawMode(true)` for instant single-key capture. State machine: `main` → submenu → action → back to main. Escape = back. `q`/Ctrl+C at main = exit.
7. **`executeAction(action)`** — Dispatcher by `action.type`:
   - `"shell"` — `execSync(cmd, { stdio: "inherit", shell: "/bin/bash" })`
   - `"shell_prompt"` — Prompt for input, substitute `{{input}}` in cmd, then exec
   - `"cd"` — Write path to `~/.local/share/j/.j_cd`, then exit (shell wrapper does actual cd)
   - `"function"` — Call a builtin JS function by name
8. **`promptUser(question)`** — Exit raw mode → readline → get input → close readline. Return to raw mode after action completes.
9. **Built-in functions** — `gitCommit` (prompts for message, appends "claude" in work mode), `gitPush`, `gitStatus`, `gitLog`, `findFile`, `findString`, `logEntry`, `statusUpdate`, `bitlyShorten`, `clipboardCopy`, `clipboardPaste`, `keyword`. Clipboard functions use platform-appropriate commands.
10. **Cleanup** — Restore cursor, reset colors, exit raw mode on SIGINT/SIGTERM/exit.
11. **`--install-only`** — Copy files to `~/.local/share/j/`, create wrapper at `~/.local/bin/j`, create `j.sh` shell function, auto-append source line to detected RC file.

### `menus.json` — Menu tree

```json
{
  "main": {
    "title": "Main",
    "items": [
      { "key": "g", "label": "it", "submenu": "git" },
      { "key": "f", "label": "ind", "submenu": "find" },
      { "key": "e", "label": "dit", "submenu": "edit" },
      { "key": "n", "label": "avigate", "submenu": "navigate" },
      { "key": "w", "label": "eb", "submenu": "web" },
      { "key": "t", "label": "ools", "submenu": "tools" },
      { "key": "r", "label": "ecent", "action": { "type": "shell", "cmd": "ls -lt | head -n 25" } }
    ]
  },
  "git": {
    "title": "Git",
    "items": [
      { "key": "c", "label": "ommit", "action": { "type": "function", "name": "gitCommit" } },
      { "key": "p", "label": "ush", "action": { "type": "function", "name": "gitPush" } },
      { "key": "s", "label": "tatus", "action": { "type": "function", "name": "gitStatus" } },
      { "key": "l", "label": "og", "action": { "type": "function", "name": "gitLog" } },
      { "key": "d", "label": "iff", "action": { "type": "shell", "cmd": "git diff" } },
      { "key": "a", "label": "dd all", "action": { "type": "shell", "cmd": "git add -A" } }
    ]
  },
  "find": {
    "title": "Find",
    "items": [
      { "key": "f", "label": "ile", "action": { "type": "function", "name": "findFile" } },
      { "key": "s", "label": "tring", "action": { "type": "function", "name": "findString" } }
    ]
  },
  "edit": {
    "title": "Edit",
    "items": [
      { "key": "r", "label": "c file", "action": { "type": "shell", "cmd": "${EDITOR:-zed} ~/.zshrc" } },
      { "key": "b", "label": "ooks", "action": { "type": "shell", "cmd": "cd ~/sandbox/joeldare.com && ${EDITOR:-zed} ./books.md" } },
      { "key": "m", "label": "orning", "action": { "type": "shell", "cmd": "${EDITOR:-zed} ~/sandbox/morning" } }
    ]
  },
  "navigate": {
    "title": "Navigate",
    "items": [
      { "key": "s", "label": "andbox", "action": { "type": "cd", "dir": "~/sandbox" } },
      { "key": "j", "label": "oeldare", "action": { "type": "cd", "dir": "~/joeldare.com" } },
      { "key": "d", "label": "raft", "action": { "type": "cd", "dir": "~/sandbox/draft" } }
    ]
  },
  "web": {
    "title": "Web",
    "items": [
      { "key": "s", "label": "tatus", "action": { "type": "function", "name": "statusUpdate" } },
      { "key": "b", "label": "itly", "action": { "type": "function", "name": "bitlyShorten" } },
      { "key": "k", "label": "eyword", "action": { "type": "function", "name": "keyword" } }
    ]
  },
  "tools": {
    "title": "Tools",
    "items": [
      { "key": "l", "label": "og", "action": { "type": "function", "name": "logEntry" } },
      { "key": "c", "label": "opy", "action": { "type": "function", "name": "clipboardCopy" } },
      { "key": "p", "label": "aste", "action": { "type": "function", "name": "clipboardPaste" } }
    ]
  }
}
```

Each item: `key` = single letter (case-insensitive), `label` = rest of display text. `(G)it` rendered from `key:"g"`, `label:"it"`. Optional `modes` array filters by `J_MODE`.

### The `cd` Problem

A child process can't change the parent shell's directory. Solution: `j.js` writes the target to `~/.local/share/j/.j_cd` and exits. A shell function wrapper (sourced in shell RC) reads the file and does the `cd`. Same approach applies to `source` commands like `reload` and `activate` if needed.

**`~/.local/share/j/j.sh`** (created by build/install):
```bash
j() {
  local cd_file="$HOME/.local/share/j/.j_cd"
  rm -f "$cd_file"
  "$HOME/.local/bin/j" "$@"
  if [[ -f "$cd_file" ]]; then
    cd "$(cat "$cd_file")"
    rm -f "$cd_file"
  fi
}
```

The install process auto-detects the user's shell (from `$SHELL`) and appends `source ~/.local/share/j/j.sh` to the appropriate RC file (`~/.zshrc` for zsh, `~/.bashrc` for bash). Checks for existing line first to avoid duplicates. No manual setup step required.

### Work Mode

`J_MODE=work` env var triggers:
- `gitCommit` appends " (claude)" to commit messages
- Menu items with `"modes": ["work"]` only appear in work mode

### Install Pattern (matches peen)

- `install.sh`: curl raw files from GitHub → `node j.js --install-only`
- `npm run build`: copy `j.js`, `menus.json`, `VERSION` to `~/.local/share/j/`, create `~/.local/bin/j` wrapper, create `j.sh` shell function
- `--install-only` in `j.js`: same as build but self-contained
- Both install methods auto-append `source` line to detected RC file (idempotent — skips if already present)

## Implementation Order

1. **Skeleton** — `j.js` with menu rendering, raw mode keystroke loop, main menu + git submenu, one working command (`git status`)
2. **Input & dispatch** — `promptUser()`, `executeAction()` dispatcher, `waitForKey()`, all action types
3. **All builtins** — gitCommit, findFile, findString, logEntry, statusUpdate, clipboard, bitly, keyword
4. **cd support** — `.j_cd` file mechanism, `j.sh` wrapper
5. **Modes** — `J_MODE` filtering, "claude" commit suffix
6. **Full menus** — Complete `menus.json` with all items from .zshrc
7. **Install** — `package.json` build script, `install.sh`, `--install-only` flag
8. **Polish** — Terminal resize handling, clean exit, error handling

## Verification

1. `node j.js` — menu renders centered with colors, 4 columns
2. Press `g` — git submenu appears instantly (no Enter)
3. Press `s` — `git status` runs, "press any key" returns to main
4. Press `g` then `c` — prompts for commit message, commits
5. Escape from submenu returns to main
6. `q` at main menu exits cleanly
7. `npm run build` installs to `~/.local/share/j/`, wrapper works
8. `source ~/.local/share/j/j.sh && j` — cd commands change parent shell dir
9. `J_MODE=work j` — commit messages get " (claude)"
