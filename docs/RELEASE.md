# Release checklist

## One time

- Signing key: `%USERPROFILE%\.tauri\melatonin.key` (private, never commit)
- Public key: embedded in `tauri.conf.json` under `plugins.updater.pubkey`
- Repo: `thevirgindev/melatonin`, public so the updater endpoint resolves without auth

## Every release

1. Bump `version` in `tauri.conf.json` and `Cargo.toml`.
2. Build with the signing key and a workspace-local temp dir (sandboxed shells hand
   build scripts a Low integrity token, so `%TEMP%` writes fail inside crates like `ring`):

   ```
   $env:TMP = "$PWD\.tmpbuild"; $env:TEMP = $env:TMP
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\melatonin.key" -Raw
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
   git tag -a v<version> -m "Melatonin <version>"
   git push origin main --tags
   gh release create v<version> \
     target\release\bundle\nsis\Melatonin_<version>_x64-setup.exe \
     target\release\bundle\nsis\Melatonin_<version>_x64-setup.exe.sig \
     target\release\bundle\latest.json \
     --title "Melatonin <version>" --notes "..."
   ```

The app checks `releases/latest/download/latest.json` four seconds after the main window
loads and offers an install toast when `version` is newer than the running build.

## Installer vs portable

- Installer: `Melatonin_<version>_x64-setup.exe` (NSIS, per-machine). This is what the
  updater installs.
- Portable: run `tools\run.ps1 -Build`, or copy `target\release\melatonin.exe` next to a
  `backend\dsh` folder. The backend is not bundled (3 GB with node_modules).
