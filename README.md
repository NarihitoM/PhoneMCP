# Phone Control MCP

Control your Android phone from Claude (or any MCP client) by just asking:
"open TikTok", "turn on dark mode", "search lofi music on YouTube".

It works over **Wi-Fi** (phone and computer on the same router, no cable) or **USB**. Nothing is installed on the phone.

---

## Easiest: let your AI agent set it up

If the steps below look hard, let an AI coding agent do them for you. It needs to be one that can run terminal commands, such as Claude Code, Codex CLI, Gemini CLI, Cursor (agent mode) or OpenCode.

1. Download this project (`git clone https://github.com/NarihitoM/PhoneMCP.git`, or **Code > Download ZIP** on GitHub) and open your AI agent inside the folder.
2. Copy the prompt below and paste it into the agent.
3. Answer its questions. It will ask before installing anything and will ask you for the pairing details shown on your phone.

```
Set up the Phone Control MCP server in this folder for me, following README.md.

1. Check Node.js 20 or newer is installed. If not, tell me how to install it and stop.
2. Check adb is installed with `adb version`. If not, install Android platform-tools
   using the command for my operating system from README Step 1. Ask me before installing.
3. Run `npm install` in this folder and confirm that `dist/index.js` exists.
4. Add this server, named "phone", to the AI tool you are running in right now, using the
   absolute path to this folder's `dist/index.js` (forward slashes on Windows). Use the
   matching config from README Step 3. Do not remove or change my other MCP servers.
   Confirm it is registered and connected.
5. Help me connect my phone:
   - Walk me through turning on Developer options and Wireless debugging (README Steps 4 and 5).
   - Ask me for the "IP address & port" and the 6-digit "Wi-Fi pairing code" from the
     "Pair device with pairing code" popup, then run `adb pair <ip:port> <code>`.
   - Connect with `adb mdns services` and `adb connect <address>`. If the phone is not found,
     ask me for the IP address & port shown on the main Wireless debugging screen.
   - If my phone and computer cannot share a Wi-Fi network, suggest the computer hotspot or
     USB options from the README.
6. Check that `adb devices` lists my phone as `device`.
7. Tell me to restart the AI tool or open a new conversation so the phone tools load, and
   suggest a first thing to try, like "what's on my phone screen?".

Rules: never use `adb tcpip`. Explain each step in simple words. If something fails, check
the Troubleshooting section of README.md before trying other fixes.
```

Prefer to do it yourself? Follow the steps below.

---

## Quick setup (about 10 minutes)

You need:

- A computer with Windows, macOS or Linux
- An Android phone (Android 11+ for Wi-Fi, any version for USB)
- [Node.js 20 or newer](https://nodejs.org)
- [Claude Code](https://claude.com/claude-code), Claude Desktop, or another MCP client

### Step 1: Install adb (Android platform-tools)

| OS | Command |
|----|---------|
| Windows | `winget install --id Google.PlatformTools -e --source winget` |
| macOS | `brew install --cask android-platform-tools` |
| Linux (Debian/Ubuntu) | `sudo apt install adb` |
| Linux (Fedora) | `sudo dnf install android-tools` |

Close and reopen your terminal, then check it works:

```
adb version
```

On Windows the server finds a winget install by itself, even before you restart.
If your Linux `adb` is older than version 30 (`adb pair` is unknown), download the latest from
[developer.android.com/tools/releases/platform-tools](https://developer.android.com/tools/releases/platform-tools).

### Step 2: Download and build the server

```
git clone https://github.com/NarihitoM/PhoneMCP.git
cd PhoneMCP
npm install
```

No git? On the [GitHub page](https://github.com/NarihitoM/PhoneMCP) click **Code > Download ZIP**, unzip it, open a terminal in the folder and run `npm install`.

This installs dependencies and builds the server into `dist/`.

### Step 3: Add it to your MCP client

In the examples below, `/full/path/to/PhoneMCP` is a placeholder. Replace it with the real location of the folder on your computer.

To find it, open a terminal inside the project folder and run `pwd` (macOS, Linux or Git Bash) or `cd` (Windows Command Prompt).

| Your folder is at | Write it as |
|-------------------|-------------|
| `C:\Users\alex\Projects\PhoneMCP` (Windows) | `C:/Users/alex/Projects/PhoneMCP` |
| `/Users/alex/PhoneMCP` (macOS) | `/Users/alex/PhoneMCP` |
| `/home/alex/PhoneMCP` (Linux) | `/home/alex/PhoneMCP` |

On Windows, change every `\` to `/`. A `\` breaks JSON config files, and `/` works on every system.

The folder can be anywhere, as long as the path in your config matches it:

- If you move or rename the folder later, update the path in your config (Claude Code: `claude mcp remove phone -s user`, then add it again).
- If the path has spaces, wrap it in quotes in terminal commands: `node "C:/My Projects/PhoneMCP/dist/index.js"`. JSON configs need no extra quotes.
- Avoid temporary folders that get cleaned up automatically.

For example, on Windows with the folder at `C:\Users\alex\Projects\PhoneMCP`:

```
claude mcp add phone -s user -- node C:/Users/alex/Projects/PhoneMCP/dist/index.js
```

**Claude Code** (available in all your projects):

```
claude mcp add phone -s user -- node /full/path/to/PhoneMCP/dist/index.js
```

Check it with `claude mcp get phone`. It should say `Connected`.

**Claude Desktop**: open Settings > Developer > Edit Config and add:

```json
{
  "mcpServers": {
    "phone": {
      "command": "node",
      "args": ["/full/path/to/PhoneMCP/dist/index.js"]
    }
  }
}
```

Config file location:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Cursor** (`~/.cursor/mcp.json`) uses the same `mcpServers` block as Claude Desktop.

**VS Code / GitHub Copilot** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "phone": {
      "type": "stdio",
      "command": "node",
      "args": ["/full/path/to/PhoneMCP/dist/index.js"]
    }
  }
}
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`) and **Cline** (MCP Servers > Configure, `cline_mcp_settings.json`) also use the same `mcpServers` block as Claude Desktop.

**Gemini CLI** (`~/.gemini/settings.json`) uses the same `mcpServers` block as Claude Desktop. Gemini only starts MCP servers in folders you trust: if `gemini mcp list` shows `phone ... Disabled`, run `gemini` in that folder and choose to trust it. It should then say `Connected`.

**OpenAI Codex CLI**:

```
codex mcp add phone -- node /full/path/to/PhoneMCP/dist/index.js
```

or in `~/.codex/config.toml`:

```toml
[mcp_servers.phone]
command = "node"
args = ["/full/path/to/PhoneMCP/dist/index.js"]
```

**OpenCode** (`opencode.json` in your project, or `~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "phone": {
      "type": "local",
      "command": ["node", "/full/path/to/PhoneMCP/dist/index.js"],
      "enabled": true
    }
  }
}
```

Check it with `opencode mcp list`. It should say `connected`.

**Any other MCP client**: it is a standard stdio server. Command `node`, argument `/full/path/to/PhoneMCP/dist/index.js`.

Restart the app (or open a **new** conversation) after adding the server. Existing conversations do not pick up new tools.

If the app says `node` is not found (common for desktop apps on macOS), use the full path to node instead of `node`. Find it with `which node` (macOS/Linux) or `where node` (Windows).

### Step 4: Turn on Developer options on the phone

1. Open **Settings > About phone**.
   - Samsung: **Settings > About phone > Software information**
   - Xiaomi: **Settings > About phone**, tap **MIUI / OS version**
2. Tap **Build number** 7 times until it says "You are now a developer".
3. Go back. **Developer options** is now in Settings (Samsung: at the bottom of Settings; Pixel: **System > Developer options**).

### Step 5: Connect the phone

#### Option A: Wi-Fi (recommended)

Wi-Fi control always uses **Wireless debugging**. It works when the **phone is connected to a Wi-Fi network** and the computer is on that same network:

| Network setup | Works? |
|---------------|--------|
| Phone and computer on the same Wi-Fi router | Yes |
| Computer makes a hotspot, phone joins it | Yes |
| Another device makes a hotspot, phone and computer both join it | Yes |
| Phone makes a hotspot, computer joins it | No. The phone is not on Wi-Fi, so Wireless debugging cannot turn on |
| Phone and computer on different networks | No. The computer cannot reach the phone |
| Phone on mobile data only | No. Wireless debugging needs Wi-Fi |
| Guest, office or public Wi-Fi | Often no. These usually block devices from talking to each other |

No shared Wi-Fi? Make a hotspot on the computer (Windows: **Settings > Network & internet > Mobile hotspot**; macOS: **System Settings > General > Sharing > Internet Sharing**) and connect the phone to it. Or use a USB cable (Option B).

1. Connect the phone and computer to the same network (see the table above).
2. On the phone: **Developer options > Wireless debugging**. Turn it on, tap **Allow**.
3. Tap the words **Wireless debugging** to open the page, then **Pair device with pairing code**.
4. A popup shows an **IP address & port** and a **6-digit Wi-Fi pairing code**. Keep it open and pair in one of these ways:

   **In the terminal (works with every AI tool).** Inside the project folder run:

   ```
   npm run pair
   ```

   Type the IP address & port and the code when asked. It pairs and connects.

   ```
   IP address & port: 192.168.1.20:41234
   Wi-Fi pairing code: 482913

   Pairing...
   Successfully paired to 192.168.1.20:41234
   Connecting...
   Ready: Pixel_8
   ```

   **In chat.** Tell your AI "pair my phone". Apps that support MCP input forms (elicitation) pop up a form for the IP address & port and code. In other apps the AI asks you for them in chat.

   **Manually.** `adb pair 192.168.1.20:41234 482913`

Pairing is **one time only** per computer. You only pair again if you use a new computer or tap **Forget** on the phone.

On a computer hotspot the firewall can block automatic discovery. If "connect my phone" cannot find it, give the address from the Wireless debugging screen (it usually looks like `192.168.137.x:port`).

#### Every time you use it

Android turns Wireless debugging **off by itself** when the phone restarts, changes Wi-Fi network, or Wi-Fi goes off. Your AI cannot turn it on for you, because it needs a connection first. So each time:

1. Make sure the phone is on the same network as the computer.
2. Turn on **Wireless debugging** on the phone.
3. Tell your AI "connect my phone" (the `connect_wifi` tool). It finds the phone automatically, no code needed.

On a new Wi-Fi network the phone asks "Allow wireless debugging on this network?" once. Tap **Allow**.

**Tip: make it one tap.** On the phone, open **Developer options > Quick settings developer tiles** and turn on **Wireless debugging**. A Wireless debugging tile appears when you swipe down from the top of the screen. Tap it, then say "connect my phone".

#### Option B: USB cable

Works anywhere, no Wi-Fi needed, and stays on after restarts.

1. On the phone: **Developer options > USB debugging** on.
2. Plug in the cable and tap **Allow** on the phone (tick "Always allow from this computer").

### Step 6: Try it

> what's on my phone screen?
>
> open TikTok
>
> open Settings and turn on dark mode

---

## Tools

| Tool | What it does |
|------|--------------|
| `list_devices` | Connected phones with serial and state |
| `device_info` | Model, Android version, screen size |
| `pair_wifi` | One-time Wireless debugging pairing, then connects (asks the user for the IP and code if not given) |
| `connect_wifi` | Connect over Wi-Fi (auto-discovers the phone, asks for the address if it can't) |
| `get_ui` | Screen as a numbered list of elements with text, id and tap position |
| `screenshot` | PNG of the screen for apps where `get_ui` is empty. Auto-shrunk to stay under about 700 KB so every MCP app accepts it (`maxSide` sets the size) |
| `tap` / `tap_element` | Tap by coordinates or by element number from `get_ui` (optional long-press) |
| `swipe` | Swipe or scroll |
| `type_text` | Type into the focused field (ASCII only) |
| `press_key` | home, back, enter, delete, tab, space, recents, power, volume_up, volume_down, menu |
| `list_apps` / `launch_app` | Find and open apps by package name |
| `open_url` | Open a link or deep link |
| `wait` | Pause for the screen to settle |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `adb was not found` | Reopen the terminal after installing, or add `ADB_PATH` (see below) |
| `No phone connected` | Turn Wireless debugging on and say "connect_wifi", or check the USB cable |
| `Phone is unauthorized` | Unlock the phone and tap **Allow** on the debugging prompt |
| `No phone found on Wi-Fi` | Same Wi-Fi on both? Paired already? Try `connect_wifi` with the ip:port from the Wireless debugging page |
| Wireless debugging won't turn on | The phone must be connected to Wi-Fi. It does not work when the phone is the hotspot or on mobile data |
| It worked yesterday, not today | Wireless debugging turned off by itself. Turn it on again and say "connect my phone" |
| Pairing fails | The code expires in about a minute. Open **Pair device with pairing code** again for a new one |
| Phone tools don't show up | Start a **new** conversation or restart the app. In Claude Code, run `/mcp` to check |
| `More than one device is connected` | Pass `serial` from `list_devices`, or set `ANDROID_SERIAL` (see below) |
| App doesn't open | Some apps have several packages (TikTok: `com.ss.android.ugc.trill` and `com.zhiliaoapp.musically`). Ask Claude to try the other |
| Typing emoji or non-English text fails | `type_text` is ASCII only |
| Screenshot is black | Banking apps and the lock screen block screenshots |
| Screenshot too large for your app | Ask for a smaller one, e.g. "screenshot with maxSide 800" |
| `node` not found in a desktop app | Use the full path to node in the config (see Step 3) |

### Settings (environment variables)

| Variable | Use |
|----------|-----|
| `ADB_PATH` | Full path to `adb` if it is not on PATH |
| `ANDROID_SERIAL` | Which phone to use when several are connected |

Claude Code example:

```
claude mcp add phone -s user -e ADB_PATH=C:/platform-tools/adb.exe -e ANDROID_SERIAL=192.168.1.20:37123 -- node /full/path/to/PhoneMCP/dist/index.js
```

Claude Desktop / Cursor: add `"env": { "ADB_PATH": "C:/platform-tools/adb.exe" }` next to `"args"`.

---

## Security

- The server talks to your MCP client only on your computer (stdio). It opens no network port.
- Wireless debugging needs a pairing code shown on the phone, so other people on the same Wi-Fi cannot connect without your approval.
- Do not use the old `adb tcpip 5555` method. It leaves an open debugging port on the network.
- Turn Wireless debugging off when you are done, avoid public Wi-Fi, and never tap **Allow** on a debugging prompt you did not start.
- Claude can do anything you can do on the phone. Watch what it does, especially in messaging, banking or payment apps.

---

## Development

```
npm run pair        # pair a phone over Wi-Fi from the terminal
npm run build       # compile to dist/
npm run typecheck   # type check only
npm test            # build and run unit tests
npm run inspect     # open the MCP Inspector against the server
```

Project layout:

```
src/
  index.ts          server entry, registers tools
  cli/pair.ts       terminal pairing (npm run pair)
  lib/adb.ts        runs adb safely (no shell), finds adb, friendly errors
  lib/tool.ts       shared tool helpers
  lib/elicit.ts     asks the user for input via MCP forms
  services/         UI dump parsing, device/Wi-Fi helpers, screenshot scaling, text escaping
  tools/            MCP tools: device, screen, input, apps
  types/            shared types
```
