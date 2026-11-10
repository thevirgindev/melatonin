# Release checklist

## One time

- Signing key: `%USERPROFILE%\.tauri\melatonyne.key` (private, never commit)
- Public key: embedded in `tauri.conf.json` under `plugins.updater.pubkey`
- Repo: `thevirgindev/melatonyne`, public so the updater endpoint resolves without auth

## Every release

1. Bump `version` in `tauri.conf.json` and `Cargo.toml`.
2. Build with the signing key and a workspace-local temp dir (sandboxed shells hand
   build scripts a Low integrity token, so `%TEMP%` writes fail inside crates like `ring`):

   ```
   $env:TMP = "$PWD\.tmpbuild"; $env:TEMP = $env:TMP
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\melatonyne.key" -Raw
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
   npx @tauri-apps/cli@2 build
   ```

3. Generate the update manifest:

   ```
   node tools/release.mjs v<version> "notes"
   ```

   Writes `target\release\bundle\latest.json` pointing at the installer asset URL.

4. Tag and publish:

   ```
   git tag -a v<version> -m "Melatonyne <version>"
   git push origin main --tags
   gh release create v<version> \
     target\release\bundle\nsis\Melatonyne_<version>_x64-setup.exe \
     target\release\bundle\nsis\Melatonyne_<version>_x64-setup.exe.sig \
     target\release\bundle\latest.json \
     --title "Melatonyne <version>" --notes "..."
   ```

The app checks `releases/latest/download/latest.json` four seconds after the main window
loads and offers an install toast when `version` is newer than the running build.

## Installer vs portable

- Installer: `Melatonyne_<version>_x64-setup.exe` (NSIS, per-machine). This is what the
  updater installs.
- Portable: run `tools\run.ps1 -Build`, or copy `target\release\melatonyne.exe` next to a
  `backend\dsh` folder. The backend is not bundled (3 GB with node_modules).
