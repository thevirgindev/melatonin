# Melatonyne

A desktop shell for the DeepSeek Harness client. Tauri v2 (Rust + WebView2) wraps the
harness web client in a native window with a custom titlebar, its own sign-in flow, and
a provider picker that accepts an API key from any supported provider.

## What is in here

```
deepr-tauri/          the app (crate name: melatonyne)
  src/main.rs         windows, host spawn, bridge, injected shell JS
  build.rs            stages the welcome renderer, ships the WebView2 loader,
                      runs tauri_build (the application manifest)
  welcome/            sign-in window (vanilla JS on top of the upstream bundle)
  dist/               embedded web client (frontendDist)
  tools/              run.ps1, bridge.mjs, release.mjs, CDP probes
vendor-backend/dsh/   the harness backend (node, compiled CLI at apps/cli/lib/bin.js)
```

`vendor-backend` is not committed (it is 3 GB with `node_modules`). The app looks for a
backend in this order: `MELATONYNE_BACKEND`, `<exe dir>\backend\dsh`, then the dev
checkout at `..\smth-new\vendor-backend\dsh`.

## Run it

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\run.ps1 -Build
```

`-Build` compiles first. The script points `TMP` at the workspace (build scripts inherit a
Low integrity label in a sandboxed shell and cannot write `%TEMP%`), then copies the binary
into `%LOCALAPPDATA%\Melatonyne\app` and launches it. The copy matters: a freshly compiled
exe can carry a Low integrity label, which stops the app and its node child from writing
`~/.dsh`.

Plain `cargo run` also works, but the shell that spawned it must allow `%TEMP%` writes and
the binary must not carry a Low label.

## Sign-in

The welcome window owns the entire flow. It talks to the host through a Node stdio bridge
(`tools/bridge.mjs`): `account/startSignIn` opens the authorize URL in the system browser,
`account/getState` polls, and on `credential-stored` the renderer emits `deepr-continue`.
The main window stays hidden until then.

## Updates

`tauri-plugin-updater` with an NSIS bundle. `tauri.conf.json` points at

```
https://github.com/thevirgindev/melatonyne/releases/latest/download/latest.json
```

`tools/release.mjs` writes that `latest.json` from the built installer and its signature.
The private signing key lives outside the repo, at `%USERPROFILE%\.tauri\melatonyne.key`.

## Build a release

```
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\melatonyne.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
$env:TMP = "$PWD\.tmpbuild"; $env:TEMP = $env:TMP
npx @tauri-apps/cli@2 build
node tools/release.mjs v1.0.0
```

Upload the NSIS installer, its `.sig`, and `latest.json` to the GitHub release.

## License

MIT.
