#!/usr/bin/env node

// j — BBS-style menu CLI
// Single-file Node.js ES module, no npm dependencies

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, chmodSync } from "fs";
import { createInterface } from "readline";
import { homedir, platform } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// ── ANSI constants ──────────────────────────────────────────────────────────
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const BRIGHT_BLUE = "\x1b[94m";
const YELLOW = "\x1b[93m";
const RESET = "\x1b[0m";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Menu erasure ─────────────────────────────────────────────────────────────
let lastMenuLines = 0;

function eraseMenu() {
  if (lastMenuLines === 0) return;
  // Clear the current line (prompt has no trailing newline)
  process.stdout.write("\x1b[2K\r");
  // Move up and clear the remaining lines
  for (let i = 1; i < lastMenuLines; i++) {
    process.stdout.write("\x1b[A\x1b[2K");
  }
  process.stdout.write("\r");
  lastMenuLines = 0;
}

// ── Platform detection ──────────────────────────────────────────────────────
function detectPlatform() {
  if (platform() === "darwin") return "macos";
  if (platform() === "linux") {
    try {
      const procVersion = readFileSync("/proc/version", "utf-8").toLowerCase();
      if (procVersion.includes("microsoft") || procVersion.includes("wsl")) return "wsl";
    } catch {}
    return "linux";
  }
  return "linux";
}

const PLATFORM = detectPlatform();

// ── Clipboard helpers ───────────────────────────────────────────────────────
function clipboardCopyCmd() {
  if (PLATFORM === "macos") return "pbcopy";
  if (PLATFORM === "wsl") return "clip.exe";
  return "xclip -selection clipboard";
}

function clipboardPasteCmd() {
  if (PLATFORM === "macos") return "pbpaste";
  if (PLATFORM === "wsl") return "powershell.exe -c Get-Clipboard";
  return "xclip -selection clipboard -o";
}

// ── Load menus ──────────────────────────────────────────────────────────────
function loadMenus() {
  const menusPath = join(__dirname, "menus.json");
  return JSON.parse(readFileSync(menusPath, "utf-8"));
}

// ── Mode filtering ──────────────────────────────────────────────────────────
function filterByMode(items, mode) {
  if (!mode) return items.filter((item) => !item.modes);
  return items.filter((item) => !item.modes || item.modes.includes(mode));
}

// ── Render menu ─────────────────────────────────────────────────────────────
function renderMenu(menuKey, menus) {
  const menu = menus[menuKey];
  if (!menu) return;

  eraseMenu();

  const mode = process.env.J_MODE || "";
  const items = filterByMode(menu.items, mode);
  const cols = process.stdout.columns || 80;

  // Title
  const titleText = mode && menuKey === "main" ? `${menu.title} [${mode}]` : menu.title;
  const titleLine = `${RED}--- ${YELLOW}${titleText}${RED} ---${RESET}`;
  // Calculate visible length (without ANSI codes)
  const visibleLen = `--- ${titleText} ---`.length;
  const titlePad = Math.max(0, Math.floor((cols - visibleLen) / 2));
  process.stdout.write(" ".repeat(titlePad) + titleLine + "\n\n");

  // Items in 4 columns × 18 chars
  const colWidth = 18;
  const numCols = 4;
  const totalWidth = colWidth * numCols;
  const leftPad = Math.max(0, Math.floor((cols - totalWidth) / 2));

  const itemRows = Math.ceil(items.length / numCols);
  for (let i = 0; i < items.length; i += numCols) {
    let line = " ".repeat(leftPad);
    for (let c = 0; c < numCols && i + c < items.length; c++) {
      const item = items[i + c];
      const display = `(${YELLOW}${item.key.toUpperCase()}${RESET})${item.label}`;
      const visibleItemLen = `(${item.key.toUpperCase()})${item.label}`.length;
      line += display + " ".repeat(Math.max(1, colWidth - visibleItemLen));
    }
    process.stdout.write(line + "\n");
  }

  // Prompt (cursor stays on this line)
  process.stdout.write(`\n${" ".repeat(leftPad)}${BRIGHT_BLUE}${menu.title} Menu ${BLUE}:${RESET} `);

  // Track lines: title + blank + item rows + blank + prompt
  lastMenuLines = 2 + itemRows + 1 + 1;
}

// ── Prompt user (exits raw mode temporarily) ────────────────────────────────
function promptUser(question) {
  return new Promise((resolve) => {
    if (process.stdin.isRaw) process.stdin.setRawMode(false);
    process.stdout.write(SHOW_CURSOR);

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ── Wait for any key ────────────────────────────────────────────────────────
function waitForKey(msg = "\nPress any key to continue...") {
  return new Promise((resolve) => {
    process.stdout.write(msg);
    if (!process.stdin.isRaw) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", () => {
      resolve();
    });
  });
}

// ── Execute action ──────────────────────────────────────────────────────────
async function executeAction(action) {
  eraseMenu();
  process.stdout.write(SHOW_CURSOR);

  switch (action.type) {
    case "shell":
      try {
        execSync(action.cmd, { stdio: "inherit", shell: "/bin/bash" });
      } catch {}
      cleanup();
      process.exit(0);
      break;

    case "shell_prompt": {
      const input = await promptUser(action.prompt || "Input: ");
      if (input) {
        const cmd = action.cmd.replace(/\{\{input\}\}/g, input);
        try {
          execSync(cmd, { stdio: "inherit", shell: "/bin/bash" });
        } catch {}
      }
      cleanup();
      process.exit(0);
      break;
    }

    case "cd": {
      const dir = action.dir.replace(/^~/, homedir());
      const cdFile = join(homedir(), ".local", "share", "j", ".j_cd");
      mkdirSync(dirname(cdFile), { recursive: true });
      writeFileSync(cdFile, dir);
      cleanup();
      process.exit(0);
      break;
    }

    case "function":
      await builtins[action.name]();
      cleanup();
      process.exit(0);
      break;

    case "quit":
      cleanup();
      process.exit(0);
      break;

    case "back":
      return "back";
  }
}

// ── Built-in functions ──────────────────────────────────────────────────────
const builtins = {
  async gitCommit() {
    let msg = await promptUser("Commit message: ");
    if (!msg) return;
    const mode = process.env.J_MODE || "";
    if (mode === "work") msg += " (claude)";
    try {
      execSync(`git add -A && git commit -m "${msg.replace(/"/g, '\\"')}"`, {
        stdio: "inherit",
        shell: "/bin/bash",
      });
    } catch {}
  },

  async gitPush() {
    try {
      execSync("git push", { stdio: "inherit", shell: "/bin/bash" });
    } catch {}
  },

  async gitStatus() {
    try {
      execSync("git status", { stdio: "inherit", shell: "/bin/bash" });
    } catch {}
  },

  async gitLog() {
    try {
      execSync("git log --oneline -20", { stdio: "inherit", shell: "/bin/bash" });
    } catch {}
  },

  async findFile() {
    const pattern = await promptUser("File pattern: ");
    if (!pattern) return;
    try {
      execSync(`find . -name "${pattern.replace(/"/g, '\\"')}" -not -path "*/node_modules/*" -not -path "*/.git/*"`, {
        stdio: "inherit",
        shell: "/bin/bash",
      });
    } catch {}
  },

  async findString() {
    const pattern = await promptUser("Search string: ");
    if (!pattern) return;
    try {
      execSync(
        `grep -rn "${pattern.replace(/"/g, '\\"')}" . --include="*" --exclude-dir=node_modules --exclude-dir=.git`,
        { stdio: "inherit", shell: "/bin/bash" }
      );
    } catch {}
  },

  async logEntry() {
    const entry = await promptUser("Log entry: ");
    if (!entry) return;
    const date = new Date().toISOString().split("T")[0];
    const logDir = join(homedir(), ".local", "share", "j");
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, "log.txt");
    const line = `${date} ${entry}\n`;
    try {
      const existing = existsSync(logFile) ? readFileSync(logFile, "utf-8") : "";
      writeFileSync(logFile, existing + line);
      process.stdout.write(`Logged: ${line}`);
    } catch {}
  },

  async statusUpdate() {
    const status = await promptUser("Status update: ");
    if (!status) return;
    try {
      execSync(
        `curl -s -X POST "https://joeldare.com/api/status" -H "Content-Type: application/json" -d '{"status":"${status.replace(/'/g, "'\\''")}"}'`,
        { stdio: "inherit", shell: "/bin/bash" }
      );
    } catch {}
  },

  async bitlyShorten() {
    const url = await promptUser("URL to shorten: ");
    if (!url) return;
    const token = process.env.BITLY_TOKEN || "";
    if (!token) return;
    try {
      const result = execSync(
        `curl -s -X POST "https://api-ssl.bitly.com/v4/shorten" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"long_url":"${url}"}'`,
        { shell: "/bin/bash" }
      );
      const data = JSON.parse(result.toString());
      if (data.link) {
        process.stdout.write(`Short URL: ${data.link}\n`);
        try {
          execSync(`echo -n "${data.link}" | ${clipboardCopyCmd()}`, { shell: "/bin/bash" });
          process.stdout.write("(copied to clipboard)\n");
        } catch {}
      }
    } catch {}
  },

  async clipboardCopy() {
    const text = await promptUser("Text to copy: ");
    if (!text) return;
    try {
      execSync(`echo -n "${text.replace(/"/g, '\\"')}" | ${clipboardCopyCmd()}`, {
        shell: "/bin/bash",
      });
      process.stdout.write("Copied to clipboard\n");
    } catch {}
  },

  async clipboardPaste() {
    try {
      const result = execSync(clipboardPasteCmd(), { shell: "/bin/bash" });
      process.stdout.write(result.toString() + "\n");
    } catch {}
  },

  async keyword() {
    const kw = await promptUser("Keyword: ");
    if (!kw) return;
    try {
      execSync(`open "https://www.google.com/search?q=${encodeURIComponent(kw)}"`, {
        stdio: "inherit",
        shell: "/bin/bash",
      });
    } catch {}
  },
};

// ── Cleanup ─────────────────────────────────────────────────────────────────
function cleanup() {
  eraseMenu();
  process.stdout.write(SHOW_CURSOR + RESET);
  try {
    if (process.stdin.isRaw) process.stdin.setRawMode(false);
  } catch {}
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
process.on("exit", () => {
  cleanup();
});

// ── Install ─────────────────────────────────────────────────────────────────
function install() {
  const shareDir = join(homedir(), ".local", "share", "j");
  const binDir = join(homedir(), ".local", "bin");

  mkdirSync(shareDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });

  // Copy application files
  for (const file of ["j.js", "menus.json", "VERSION"]) {
    const src = join(__dirname, file);
    const dest = join(shareDir, file);
    if (existsSync(src)) copyFileSync(src, dest);
  }

  // Create bin wrapper
  const binWrapper = join(binDir, "j");
  writeFileSync(
    binWrapper,
    `#!/bin/bash\nnode "${join(shareDir, "j.js")}" "$@"\n`
  );
  chmodSync(binWrapper, 0o755);

  // Create shell function wrapper
  const shWrapper = join(shareDir, "j.sh");
  writeFileSync(
    shWrapper,
    `j() {
  local cd_file="$HOME/.local/share/j/.j_cd"
  rm -f "$cd_file"
  "$HOME/.local/bin/j" "$@"
  if [[ -f "$cd_file" ]]; then
    cd "$(cat "$cd_file")"
    rm -f "$cd_file"
  fi
}
`
  );

  // Auto-detect RC file and append source line
  const shell = process.env.SHELL || "";
  const rcFile = shell.endsWith("zsh")
    ? join(homedir(), ".zshrc")
    : join(homedir(), ".bashrc");

  const sourceLine = `source "${join(shareDir, "j.sh")}"`;

  let rcContent = "";
  if (existsSync(rcFile)) {
    rcContent = readFileSync(rcFile, "utf-8");
  }

  if (!rcContent.includes(sourceLine)) {
    writeFileSync(rcFile, rcContent + (rcContent.endsWith("\n") ? "" : "\n") + sourceLine + "\n");
    console.log(`Added source line to ${rcFile}`);
  } else {
    console.log(`Source line already in ${rcFile}`);
  }

  console.log(`Installed to ${shareDir}`);
  console.log(`Wrapper at ${binWrapper}`);
  console.log(`Shell function at ${shWrapper}`);
  console.log("\nRestart your shell or run: source " + shWrapper);
}

// ── Auto-update ─────────────────────────────────────────────────────────────
function autoUpdate() {
  const repo = "joeldare/j";
  const branch = "main";
  const base = `https://raw.githubusercontent.com/${repo}/${branch}`;
  const shareDir = join(homedir(), ".local", "share", "j");

  try {
    // Check remote version (1s timeout)
    const remoteVer = execSync(`curl -sf --max-time 1 "${base}/VERSION"`, {
      shell: "/bin/bash",
    }).toString().trim();

    const localVerFile = join(shareDir, "VERSION");
    const localVer = existsSync(localVerFile)
      ? readFileSync(localVerFile, "utf-8").trim()
      : "0.0.0";

    if (remoteVer === localVer) return;

    // New version available — pull files silently
    for (const file of ["j.js", "menus.json", "VERSION"]) {
      execSync(`curl -sf --max-time 3 "${base}/${file}" -o "${join(shareDir, file)}"`, {
        shell: "/bin/bash",
      });
    }
  } catch {
    // Offline or error — continue with current version
  }
}

// ── Handle --install-only ───────────────────────────────────────────────────
if (process.argv.includes("--install-only")) {
  install();
  process.exit(0);
}

// ── Main loop ───────────────────────────────────────────────────────────────
async function main() {
  autoUpdate();
  const menus = loadMenus();
  let currentMenu = "main";

  process.stdout.write(HIDE_CURSOR);

  const showMenu = () => renderMenu(currentMenu, menus);

  showMenu();

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf-8");

  const handleKey = async (key) => {
    // Remove listener while processing
    process.stdin.removeListener("data", onData);

    const code = key.charCodeAt(0);

    // Ctrl+C
    if (code === 3) {
      cleanup();
      process.exit(0);
    }

    // Escape — quit from any menu
    if (code === 27) {
      cleanup();
      process.exit(0);
    }

    const mode = process.env.J_MODE || "";
    const menu = menus[currentMenu];
    if (!menu) {
      process.stdin.on("data", onData);
      return;
    }

    const items = filterByMode(menu.items, mode);
    const match = items.find((item) => item.key.toLowerCase() === key.toLowerCase());

    if (match) {
      if (match.submenu) {
        currentMenu = match.submenu;
        showMenu();
      } else if (match.action) {
        const result = await executeAction(match.action);
        currentMenu = "main";
        showMenu();
        // Re-enter raw mode after action
        if (!process.stdin.isRaw) process.stdin.setRawMode(true);
        process.stdin.resume();
      }
    }

    process.stdin.on("data", onData);
  };

  const onData = (key) => handleKey(key);
  process.stdin.on("data", onData);
}

main().catch((e) => {
  cleanup();
  console.error(e);
  process.exit(1);
});
