# j

A BBS-style menu CLI for common dev tasks. No dependencies — just Node.js.

Navigate menus with single keystrokes to run git commands, find files, edit
configs, shorten URLs, and more. Menus are defined in `menus.json` and easy to
customize.

## Install

Requires Node.js 18+.

```bash
curl -sL https://raw.githubusercontent.com/joeldare/j/main/install.sh | bash
```

Then restart your shell, or:

```bash
source ~/.local/share/j/j.sh
```

## Usage

```bash
j
```

The main usage mode is short key combinations. For example, `j` `Enter` `g` `c`
to git commit — four keystrokes from your shell to a committed change.

Press a highlighted letter to select a menu item. Press `ESC` to quit from any
menu.

## Customization

Edit `~/.local/share/j/menus.json` to add, remove, or rearrange menu items.

Set the `J_MODE` environment variable to filter items by mode (items with a
matching `modes` array will be shown).
