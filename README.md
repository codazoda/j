# j

A BBS-style menu CLI for common dev tasks. No dependencies — just Node.js.

Navigate menus with single keystrokes to run git commands, find files, edit
configs, shorten URLs, and more. Menus are defined in `menus.json` and easy to
customize.

## Install

Requires Node.js 18+.

```bash
git clone https://github.com/codazoda/j.git ~/sandbox/j
echo 'source ~/sandbox/j/j.sh' >> ~/.zshrc  # or ~/.bashrc for bash
```

Then restart your shell, or:

```bash
source ~/sandbox/j/j.sh
```

## Uninstall

To remove `j`:

```bash
rm -rf ~/sandbox/j
```

Then remove the `source ~/sandbox/j/j.sh` line from your `~/.zshrc` or `~/.bashrc`.

If you previously used the old `install.sh` method, also remove:

```bash
rm -rf ~/.local/share/j
rm -f ~/.local/bin/j
```

And remove any `source ~/.local/share/j/j.sh` line from your shell config.

## Update

Since `j` runs directly from the cloned repo, updates are automatic with git:

```bash
cd ~/sandbox/j && git pull
```

## Usage

```bash
j
```

The main usage mode is short key combinations. For example, `j` `Enter` `g` `c`
to git commit — four keystrokes from your shell to a committed change.

Press a highlighted letter to select a menu item. Press `ESC` to quit from any
menu.

## Environment Variables

`BITLY_TOKEN` — Required for the Web > Bitly URL shortener. Generate a token at
https://app.bitly.com/settings/api/ and add to your shell profile:

```bash
export BITLY_TOKEN="your_token_here"
```

## Customization

Edit `~/sandbox/j/menus.json` (or wherever you cloned the repo) to add, remove, or rearrange menu items. You can also use the `j add` command to interactively add new menu items.

Set the `J_MODE` environment variable to filter items by mode (items with a
matching `modes` array will be shown).
