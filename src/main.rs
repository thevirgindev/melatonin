use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::os::windows::ffi::OsStrExt;
use std::sync::{Arc, Mutex};
use tauri::WebviewWindow;
use tauri::{Listener, Manager, WebviewUrl, WebviewWindowBuilder};

/// Backend root, resolved once at startup. Order: MELATONYNE_BACKEND env,
/// `backend\dsh` next to the exe (portable install), then the dev checkout.
fn resolve_backend() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("MELATONYNE_BACKEND") {
        let p = std::path::PathBuf::from(p);
        if p.join("apps").is_dir() {
            return p;
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for candidate in [dir.join("backend").join("dsh"), dir.join("backend")] {
                if candidate.join("apps").is_dir() {
                    return candidate;
                }
            }
        }
    }
    std::path::PathBuf::from(r"C:\Users\user\Documents\smth-new\vendor-backend\dsh")
}

static BACKEND: Mutex<Option<std::path::PathBuf>> = Mutex::new(None);

fn backend() -> std::path::PathBuf {
    let mut g = BACKEND.lock().unwrap();
    if g.is_none() {
        *g = Some(resolve_backend());
    }
    g.clone().unwrap()
}

fn dist_dir() -> std::path::PathBuf {
    backend().join("apps").join("web").join("dist")
}

#[link(name = "dwmapi")]
extern "system" {
    fn DwmSetWindowAttribute(hwnd: isize, attr: u32, value: *const core::ffi::c_void, size: u32) -> i32;
}

#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteW(
        hwnd: isize,
        operation: *const u16,
        file: *const u16,
        parameters: *const u16,
        directory: *const u16,
        show_cmd: i32,
    ) -> isize;
}

/// Hand a URL to the system browser. ShellExecuteW takes the string as one
/// argument, so `&` in query strings survives (cmd /C start splits on it).
fn open_external(url: &str) {
    let file: Vec<u16> = std::ffi::OsStr::new(url)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let op: Vec<u16> = "open\0".encode_utf16().collect();
    unsafe {
        ShellExecuteW(0, op.as_ptr(), file.as_ptr(), std::ptr::null(), std::ptr::null(), 1);
    }
}

/// Windows 11 draws a light border on rounded borderless windows; set it to the
/// window's dark fill so the caption edge reads as part of the app.
fn set_border_color(window: &WebviewWindow) {
    let hwnd = match window.hwnd() {
        Ok(h) => h.0 as isize,
        Err(_) => return,
    };
    let colorref: u32 = (0x15 << 16) | (0x11 << 8) | 0x0F;
    unsafe {
        DwmSetWindowAttribute(hwnd, 34, &colorref as *const u32 as *const core::ffi::c_void, 4);
        // DWMWCP_ROUND: rounded corners like stock Win11 apps
        let round: u32 = 2;
        DwmSetWindowAttribute(hwnd, 33, &round as *const u32 as *const core::ffi::c_void, 4);
    }
}

fn spawn_host(key: Option<&str>) -> (Child, String) {
    let root = backend();
    // Prefer the compiled CLI (no tsx transform at boot); fall back to the
    // TypeScript entry for source checkouts.
    let compiled = root.join("apps").join("cli").join("lib").join("bin.js");
    let mut cmd = Command::new("node");
    if compiled.is_file() {
        cmd.args([compiled.to_string_lossy().as_ref(), "web", "--no-open", "--port", "0"]);
    } else {
        cmd.args(["--import", "tsx/esm", "apps/cli/src/bin.ts", "web", "--no-open", "--port", "0"]);
    }
    cmd.current_dir(&root)
        .env("DSH_BUILD_CLIENT_PROFILE", "official");
    if let Some(k) = key {
        cmd.env("DEEPSEEK_API_KEY", k);
    }
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn dsh web host");

    let stdout = child.stdout.take().expect("host stdout piped");
    let mut stderr = child.stderr.take().expect("host stderr piped");
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match stderr.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => { eprintln!("{}", String::from_utf8_lossy(&buf[..n])); }
                Err(_) => break,
            }
        }
    });
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        eprintln!("{}", line);
        if let Some(url) = line.strip_prefix("dsh web: ") {
            return (child, url.trim().to_string());
        }
    }
    panic!("dsh web host exited without printing its URL");
}

/// The host mints a fresh `dsh-auth-<random>` cookie on every launch, all scoped
/// to 127.0.0.1. WebView2 keeps them forever, so after enough runs the Cookie
/// header crosses Node's default 16 KB limit and the host answers 431 before a
/// single byte of the app loads. The cookie is useless across runs anyway (its
/// authority is the previous run's port), so the store starts clean each boot.
fn purge_stale_cookies() {
    if let Ok(dir) = std::env::var("LOCALAPPDATA") {
        let net = Path::new(&dir)
            .join("com.melatonyne.app")
            .join("EBWebView")
            .join("Default")
            .join("Network");
        for f in ["Cookies", "Cookies-journal"] {
            let p = net.join(f);
            if p.exists() {
                let _ = std::fs::remove_file(&p);
            }
        }
    }
}

fn stored_key() -> Option<String> {
    std::env::var("LOCALAPPDATA").ok().and_then(|dir| {
        let p = Path::new(&dir).join("deepr-tauri").join("api-key.txt");
        std::fs::read_to_string(p)
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    })
}

fn store_key(value: &str) {
    if let Ok(dir) = std::env::var("LOCALAPPDATA") {
        let p = Path::new(&dir).join("deepr-tauri");
        let _ = std::fs::create_dir_all(&p);
        let _ = std::fs::write(p.join("api-key.txt"), value.trim());
    }
}

/** Stage the desktop welcome renderer under the served web dist, refresh stale copies. */
fn stage_welcome() {
    let dst = dist_dir().join("__dsh-welcome");
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("welcome");
    for sub in ["lib/welcome", "renderer"] {
        let s = src.join(sub);
        let d = dst.join(sub);
        let _ = std::fs::create_dir_all(&d);
        if let Ok(entries) = std::fs::read_dir(&s) {
            for e in entries.flatten() {
                let to = d.join(e.file_name());
                let stale = std::fs::metadata(&to)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .map(|old| {
                        std::fs::metadata(s.join(e.file_name()))
                            .ok()
                            .and_then(|m| m.modified().ok())
                            .map(|new| old < new)
                            .unwrap_or(true)
                    })
                    .unwrap_or(true);
                if stale {
                    let _ = std::fs::copy(s.join(e.file_name()), &to);
                }
            }
        }
    }
}

/** Native shell sync mirroring apps/desktop/src/preload-windows.ts. */
// Re-entrant: the Rust watchdog re-evaluates this payload periodically, so the
// timer and the boot function live on window and are installed exactly once.
const SHELL_JS: &str = r#"
    (function() {
      function start() {
      var root = document.documentElement;
      if (!root) return;
      root.setAttribute('data-windows-titlebar', '');
      root.style.setProperty('--dsh-windows-titlebar-height', '40px');
      document.title = 'Melatonyne';
      if (!window.__deeprOpenPatched) {
        window.__deeprOpenPatched = 1;
        window.open = function(url) {
          var u = String(url == null ? '' : url);
          function ext(v) {
            var s = String(v || '');
            if (/^https?:/i.test(s)) {
              try { window.__TAURI__.event.emit('deepr-open-url', s); } catch (e) {}
            }
          }
          if (u && u !== 'about:blank' && /^https?:/i.test(u)) { ext(u); return null; }
          var loc = { href: 'about:blank', assign: ext, replace: ext, reload: function(){}, toString: function(){ return 'about:blank'; } };
          Object.defineProperty(loc, 'href', {
            get: function(){ return 'about:blank'; },
            set: function(v){ ext(v); }
          });
          var proxy = { closed: false, focus: function(){}, close: function(){ this.closed = true; }, postMessage: function(){} };
          Object.defineProperty(proxy, 'location', {
            get: function(){ return loc; },
            set: function(v){ ext(v); }
          });
          return proxy;
        };
      }
      if (!window.__melUpdate) {
        window.__melUpdate = true;
        // GitHub Releases updater. Silent check on boot; when a newer signed
        // build exists, offer it in a small on-brand toast. Install runs the
        // signed NSIS package, then the app is restarted by the installer.
        function showUpdate(version, install) {
          if (document.getElementById('mel-update')) return;
          var box = document.createElement('div');
          box.id = 'mel-update';
          box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:268px;padding:12px 14px;border-radius:12px;background:rgb(24,25,28);color:#f9fafb;font:13px/18px -apple-system,Segoe UI,sans-serif;box-shadow:0 0 0 .5px rgba(255,255,255,.18),0 12px 32px rgba(0,0,0,.45);';
          var title = document.createElement('div');
          title.textContent = 'Melatonyne ' + version + ' is available';
          title.style.cssText = 'font-weight:600;margin-bottom:8px;';
          var row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
          var later = document.createElement('button');
          later.textContent = 'Later';
          later.style.cssText = 'height:28px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#c9cdd4;cursor:pointer;font:inherit;';
          later.onclick = function(){ box.remove(); };
          var go = document.createElement('button');
          go.textContent = 'Install';
          go.style.cssText = 'height:28px;padding:0 12px;border-radius:8px;border:0;background:#f9fafb;color:#353638;cursor:pointer;font:inherit;font-weight:600;';
          go.onclick = function(){
            go.disabled = true;
            go.textContent = 'Installing...';
            install().then(function(){
              title.textContent = 'Installed. Close Melatonyne to finish.';
              row.remove();
            }).catch(function(){
              go.disabled = false;
              go.textContent = 'Retry';
            });
          };
          row.appendChild(later); row.appendChild(go);
          box.appendChild(title); box.appendChild(row);
          document.body.appendChild(box);
        }
        setTimeout(function(){
          try {
            if (!window.__TAURI__ || !window.__TAURI__.core) return;
            var inv = window.__TAURI__.core.invoke;
            inv('plugin:updater|check').then(function(update){
              if (!update) return;
              if (!update.available && !update.version) return;
              showUpdate(update.version, function(){
                return inv('plugin:updater|download_and_install');
              });
            }).catch(function(){});
          } catch (e) {}
        }, 4000);
      }
      if (!window.__deeprGS) {
        window.__deeprGS = true;
        function killGetStarted() {
          var ps = document.querySelectorAll('p');
          for (var i = 0; i < ps.length; i++) {
            var t = String(ps[i].textContent || '');
            if (t.indexOf('Sign in to your DeepSeek account') === -1) continue;
            var n = ps[i];
            while (n.parentElement && n.parentElement !== document.body) n = n.parentElement;
            if (n && n !== document.body) {
              n.remove();
              window.__deeprGSCount = (window.__deeprGSCount || 0) + 1;
              return true;
            }
          }
          return false;
        }
        killGetStarted();
        window.__deeprGSRun = setInterval(function(){ killGetStarted(); }, 700);
        new MutationObserver(function(){ killGetStarted(); }).observe(document.documentElement || document.body, { childList: true, subtree: true });
      }
      if (window.__deeprShellBoot) {
        try { window.__deeprShellBoot(); } catch (e) {}
        return;
      }
      function boot() {
        if (document.getElementById('deepr-winsys')) return;
        if (!window.__TAURI__ || !window.__TAURI__.window) { setTimeout(boot, 150); return; }
        var W = window.__TAURI__.window.getCurrentWindow();
        var host = document.createElement('div');
        host.id = 'deepr-winsys';
        host.style.cssText = 'position:fixed;top:0;right:0;width:138px;height:40px;z-index:2147483647;display:flex;';
        function btn(glyph, hover, action) {
          var b = document.createElement('button');
          b.innerHTML = glyph;
          b.style.cssText = 'width:46px;height:40px;border:0;background:transparent;color:#f9fafb;font-size:10px;cursor:default;display:flex;align-items:center;justify-content:center;font-family:"Segoe MDL2 Assets",sans-serif;';
          b.onmouseenter = function(){ b.style.background = hover; };
          b.onmouseleave = function(){ b.style.background = 'transparent'; };
          b.onclick = function(ev){ ev.stopPropagation(); action(); };
          return b;
        }
        host.appendChild(btn('&#xE921;', 'rgba(255,255,255,0.06)', function(){ W.minimize(); }));
        host.appendChild(btn('&#xE922;', 'rgba(255,255,255,0.06)', function(){ W.toggleMaximize(); }));
        host.appendChild(btn('&#xE8BB;', '#e81123', function(){ W.close(); }));
        var drag = document.createElement('div');
        drag.id = 'deepr-dragband';
        drag.style.cssText = 'position:fixed;top:0;left:0;right:0;height:40px;z-index:2147483646;';
        drag.addEventListener('mousedown', function(e){ if (e.button === 0) { W.startDragging(); } });
        drag.addEventListener('dblclick', function(){ W.toggleMaximize(); });
        document.body.appendChild(drag);
        document.body.appendChild(host);
      }
      if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot, { once: true });
      window.__deeprShellBoot = boot;
      }
      try { start(); } catch (e) {}
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
      window.__deeprShellStart = start;
    })(); 
    "#;

const POLISH_JS: &str = r#"
    (function() {
      var POLISH = ' ' +
        ' [data-windows-titlebar] ._4Tsp6q_frame::before, [data-windows-titlebar] ._4Tsp6q_frame { background: rgb(15, 17, 21) !important; } ' +
        ' [data-windows-titlebar] ._4Tsp6q_centerCol { border-radius: 16px 0 0 0 !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_root { background: transparent !important; } ' +
        ' [data-windows-titlebar] html, [data-windows-titlebar] body { background: rgb(15, 17, 21) !important; } ' +
        ' [data-windows-titlebar] [class*="_4Tsp6q_frame"] { transition: grid-template-columns 160ms cubic-bezier(0.2, 0, 0, 1) !important; } ' +
        ' [data-windows-titlebar] ._4Tsp6q_sidebarCol, [data-windows-titlebar] ._4Tsp6q_frame { background: rgb(15, 17, 21) !important; } ' +
        ' [data-windows-titlebar] ._4Tsp6q_sidebarCol { border-right: 0 !important; } ' +
        ' html, body { background: rgb(15, 17, 21) !important; } ' +
        ' .HBYDDG_logoRow { margin-bottom: 16px !important; } ' +
        ' .HBYDDG_newSessionShortcut { display: none !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_root:not(.HBYDDG_collapsed) .HBYDDG_toggle { position: static !important; top: auto !important; left: auto !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_brandMark { transform: translateX(1px); } ' +
        ' [data-windows-titlebar] .HBYDDG_root.HBYDDG_collapsed { padding: 12px 8px 8px !important; width: 52px !important; min-width: 52px !important; opacity: 1 !important; visibility: visible !important; display: flex !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_collapsed .HBYDDG_panelList, [data-windows-titlebar] .HBYDDG_collapsed .HBYDDG_regionArea, [data-windows-titlebar] .HBYDDG_collapsed .HBYDDG_footArea { display: revert !important; opacity: 1 !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_collapsed [class*="_exits_"], [data-windows-titlebar] [class*="HNzaqq_fade"] { display: none !important; opacity: 0 !important; pointer-events: none !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_collapsed [class*="HNzaqq_list"] > :not([class*="railsum"]) { display: none !important; } ' +
        ' [data-windows-titlebar] [class*="_4Tsp6q_frame"]:has(.HBYDDG_collapsed) { grid-template-columns: 52px minmax(0, 1fr) !important; } ' +
        ' [data-windows-titlebar] [class*="_4Tsp6q_frame"]:has(.HBYDDG_collapsed) [class*="_4Tsp6q_sidebarCol"] { width: 52px !important; min-width: 52px !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_collapsed .HBYDDG_logoRow { height: 36px !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_collapsed [class*="umZDoW_triggerRow"] { margin: 4px 0 10px !important; width: auto !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_collapsed [class*="umZDoW_trigger"] { padding: 0 12px !important; justify-content: center !important; gap: 6px !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_collapsed [class*="_7A56IW_label"] { font-size: 13px !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_collapsed .HBYDDG_newSession { position: static !important; top: auto !important; left: auto !important; width: 36px !important; height: 36px !important; margin: 8px 0 4px !important; } ' +
        ' [data-windows-titlebar] .HBYDDG_root.HBYDDG_collapsed .HBYDDG_toggle { position: static !important; top: auto !important; left: auto !important; width: 36px !important; height: 36px !important; margin: 0 0 4px !important; color: #f9fafb !important; } ' +
        ' [class*="_7A56IW_root"], [class*="_7A56IW_trigger"] { border: 0 !important; background: transparent !important; box-shadow: none !important; } ' +
        ' [class*="_7A56IW_trigger"]:hover { background: rgba(255,255,255,0.06) !important; border-radius: 8px !important; } ' +
        ' .umZDoW_panel { width: 1100px !important; overflow-x: hidden !important; } ' +
        ' .umZDoW_panel::-webkit-scrollbar { display: none !important; } ' +
        ' .umZDoW_options::-webkit-scrollbar { display: none !important; } ' +
        ' .umZDoW_options { overflow-x: hidden !important; } ' +
        ' .umZDoW_panel [class$="_row"], .umZDoW_panel [class$="_group"], .umZDoW_panel [class*="_setting"] { border-bottom: 0 !important; border-top: 0 !important; } ';
      function polish() {
        if (!document.head) return;
        if (document.getElementById('deepr-polish') !== null) return;
        var style = document.createElement('style');
        style.id = 'deepr-polish';
        style.textContent = POLISH;
        document.head.appendChild(style);
      }
      function start() {
      polish();
      // Watchers and listeners install once; re-evaluating the payload only
      // restores the style element, never duplicate observers or intervals.
      if (window.__deeprPolishInit) return;
      window.__deeprPolishInit = 1;

      function hideStripPanelIcon() {
        document.querySelectorAll('[data-icon]').forEach(function(el) {
          if (el.closest('#deepr-winsys')) return;
          var r = el.getBoundingClientRect();
          if (r.bottom <= 44 && r.left < 60 && r.width > 0 && el.style.display !== 'none') el.style.display = 'none';
        });
      }
      function fishPathD() {
        var p = document.querySelector('path[d^="M22.9168"]') || document.querySelector('path[d^="M22.9"]');
        if (p) return p.getAttribute('d');
        return "M22.9168 12.8753C22.6105 13.9859 21.8443 14.9392 20.8037 15.5053C19.4674 16.2323 17.8442 16.2798 16.4808 15.6322C15.5255 15.1783 14.8117 14.375 14.4754 13.3888C13.8821 13.7845 13.1894 14.0044 12.4764 14.0203C10.7938 14.0577 9.25622 13.0694 8.58315 11.5173C8.42398 11.1504 8.32924 10.758 8.30327 10.3582C7.30608 10.5181 6.2789 10.2709 5.4529 9.67292C4.30138 8.83907 3.66699 7.45789 3.79155 6.05949C3.84277 5.48455 4.02984 4.93175 4.33924 4.44192C3.21074 4.79585 1.99617 4.5492 1.09675 3.78772C0.0768228 2.92429 -0.279313 1.5034 0.222378 0.264669C0.297444 0.0793198 0.505504 -0.0270034 0.697523 0.0210214C0.889542 0.0690462 1.00843 0.257328 0.969191 0.450371C0.589886 2.3168 1.90226 3.66782 3.52857 3.55743C3.65997 3.54851 3.78426 3.61869 3.84288 3.73489C4.19531 4.43343 4.7932 5.00693 5.53424 5.35824C6.88562 6.0004 8.51347 5.75338 9.61904 4.7381C10.6033 3.83408 12.0125 3.44747 13.3639 3.71261C14.7153 3.97775 15.8282 4.86016 16.3218 6.05949C16.8996 5.86435 17.5186 5.80164 18.1274 5.87679C19.9806 6.10547 21.464 7.50284 21.8485 9.38209C22.6976 9.87151 23.16 10.7934 23.16 11.7808C23.16 12.1643 23.0764 12.5358 22.9168 12.8753Z";
      }
      function swapStartIcon() {
        var chips = Array.prototype.filter.call(document.querySelectorAll('span,div'), function(e) {
          return e.childElementCount === 1 && e.children[0].tagName === 'svg' && e.textContent.trim() === 'Start';
        });
        chips.forEach(function(chip) {
          var svg = chip.children[0];
          if (svg.dataset.deeprFish) return;
          var d = fishPathD();
          if (!d) return;
          svg.dataset.deeprFish = '1';
          svg.setAttribute('viewBox', '0 0 23.16 17.04');
          svg.setAttribute('width', '16');
          svg.setAttribute('height', '11.8');
          svg.setAttribute('fill', 'none');
          svg.innerHTML = '<path d="' + d + '" fill="currentColor"></path>';
        });
      }
      var ticking = false;
      function railWhale() {
        var collapsed = document.querySelector('.HBYDDG_collapsed');
        var t = collapsed && collapsed.querySelector('.HBYDDG_toggle');
        if (!t) return;
        var svg = t.querySelector('svg');
        if (!svg) {
          var tmp = document.createElement('span');
          t.appendChild(tmp);
          svg = t.querySelector('svg');
        }
        if (!svg) return;
        if (svg.dataset.deeprRail) return;
        var d = fishPathD();
        if (!d) return;
        svg.dataset.orig = svg.innerHTML;
        svg.dataset.deeprRail = '1';
        svg.setAttribute('viewBox', '0 0 23.16 17.04');
        svg.setAttribute('width', '22');
        svg.setAttribute('height', '16.2');
        svg.setAttribute('fill', 'none');
        svg.innerHTML = '<path d="' + d + '" fill="currentColor"></path>';
      }
      function railWhaleOff() {
        var svg = document.querySelector('.HBYDDG_toggle svg[data-deepr-rail]');
        if (!svg) return;
        var collapsed = document.querySelector('.HBYDDG_collapsed');
        if (collapsed && svg.closest('.HBYDDG_collapsed')) return;
        if (svg.dataset.orig) svg.innerHTML = svg.dataset.orig;
        delete svg.dataset.deeprRail;
      }
      function tick() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function() {
          ticking = false;
          hideStripPanelIcon(); swapStartIcon(); fixFields(); menusBelow(); railWhale(); railWhaleOff();
        });
      }
      function fixFields() {
        document.querySelectorAll('input:not([id]),textarea:not([id]),select:not([id])').forEach(function(el) {
          el.id = 'deepr-field-' + Math.floor(Math.random() * 1e6);
        });
      }
      function menusBelow() {
        // Composer-anchored menus render above the input and cover the chatbar;
        // park them under the composer dock instead.
        var dock = document.querySelector('[class*="camCca_dock"]') || document.querySelector('[class*="_dock"]') || document.querySelector('[class*="MleU8a_frame"]');
        if (!dock) return;
        var db = dock.getBoundingClientRect().bottom;
        if (!db || db < 10) return;
        var popups = document.querySelectorAll('[role=menu], [role=listbox]');
        popups.forEach(function(m) {
          var items = m.querySelectorAll('[role=menuitem],[role=option]');
          if (!items.length || items.length !== 3) return;
          var r = m.getBoundingClientRect();
          var want = Math.round(db + 8) + 'px';
          if (r.top < db && m.style.top !== want) {
            m.style.top = want;
            m.style.transform = 'none';
          }
        });
      }
      tick();
      var observer = new MutationObserver(tick);
      observer.observe(document.body, { childList: true, subtree: true });
      // Harness-style context menu (upstream desktop owns a native one via
      // preload-menu.ts; the web layer has none, so we draw a dark one).
      var cm = null;
      function closeCtx() { if (cm) { cm.remove(); cm = null; } }
      function ctxItem(label, fn, danger) {
        var b = document.createElement('div');
        b.textContent = label;
        b.style.cssText = 'height:26px;line-height:26px;padding:0 12px;font-size:13px;color:#f9fafb;cursor:default;white-space:nowrap;font-family:inherit;border-radius:6px;';
        b.onmouseenter = function(){ b.style.background = danger ? '#e81123' : 'rgba(255,255,255,0.08)'; if (danger) b.style.color = '#fff'; };
        b.onmouseleave = function(){ b.style.background = 'transparent'; if (danger) b.style.color = '#f9fafb'; };
        b.onclick = function(){ closeCtx(); try { fn(); } catch (e) {} };
        return b;
      }
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        closeCtx();
        var W = window.__TAURI__ ? window.__TAURI__.window.getCurrentWindow() : null;
        cm = document.createElement('div');
        cm.style.cssText = 'position:fixed;z-index:2147483646;min-width:150px;padding:4px;border-radius:8px;background:rgb(28,28,31);border:0.5px solid rgba(255,255,255,0.14);box-shadow:0 8px 20px rgba(0,0,0,0.38);';
        var sel = document.getSelection() && document.getSelection().toString().length > 0;
        cm.appendChild(ctxItem('Back', function(){ history.back(); }));
        cm.appendChild(ctxItem('Forward', function(){ history.forward(); }));
        cm.appendChild(ctxItem('Reload', function(){ location.reload(); }));
        var sep = document.createElement('div');
        sep.style.cssText = 'height:0.5px;background:rgba(255,255,255,0.12);margin:3px 6px;';
        cm.appendChild(sep);
        if (sel) cm.appendChild(ctxItem('Copy', function(){ document.execCommand('copy'); }));
        cm.appendChild(ctxItem('Inspect', function(){ W && W.openDevtools(); }));
        var mx = Math.min(e.clientX, window.innerWidth - 200);
        var my = Math.min(e.clientY, window.innerHeight - 220);
        cm.style.left = mx + 'px'; cm.style.top = my + 'px';
        document.body.appendChild(cm);
      }, true);
      document.addEventListener('mousedown', function(e){ if (cm && !cm.contains(e.target)) closeCtx(); }, true);
      window.addEventListener('blur', closeCtx);
      setInterval(function(){ if (document.getElementById('deepr-polish') === null && document.head) polish(); }, 1000);
      }
      try { start(); } catch (e) {}
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
      window.__deeprPolishStart = start;
    })();
    "#;

fn welcome_clicks(window: &WebviewWindow) {
    let js = r#"
    (function() {
      function boot() {
        var style = document.createElement('style');
        style.textContent = 'html, body { margin: 0 !important; background: #0F1115 !important; overflow: hidden !important; border: 0 !important; box-shadow: none !important; } ' +
          'html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; scrollbar-width: none !important; }' +
          '#root { background: #0F1115 !important; }';
        document.head.appendChild(style);
        if (document.getElementById('deepr-welcomebar')) return;
        var W = window.__TAURI__.window.getCurrentWindow();
        var host = document.createElement('div');
        host.id = 'deepr-welcomebar';
        host.style.cssText = 'position:fixed;top:0;right:0;width:92px;height:42px;z-index:2147483647;display:flex;';
        function btn(glyph, hover, action) {
          var b = document.createElement('button');
          b.innerHTML = glyph;
          b.style.cssText = 'width:46px;height:42px;border:0;background:transparent;color:#f9fafb;font-size:10px;cursor:default;display:flex;align-items:center;justify-content:center;font-family:"Segoe MDL2 Assets",sans-serif;';
          b.onmouseenter = function(){ b.style.background = 'rgba(255,255,255,0.08)'; };
          b.onmouseleave = function(){ b.style.background = 'transparent'; };
          b.onclick = function(ev){ ev.stopPropagation(); action(); };
          return b;
        }
        host.appendChild(btn('&#xE921;', 'rgba(0,0,0,0.05)', function(){ W.minimize(); }));
        host.appendChild(btn('&#xE8BB;', '#e81123', function(){ window.__TAURI__.event.emit('deepr-close'); }));
        var drag = document.createElement('div');
        drag.style.cssText = 'position:fixed;top:0;left:0;right:0;height:42px;z-index:2147483646;';
        drag.addEventListener('mousedown', function(e){ if (e.button === 0) { W.startDragging(); } });
        drag.addEventListener('dblclick', function(){ W.toggleMaximize(); });
        document.body.appendChild(drag);
        document.body.appendChild(host);
      }
      if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
      setInterval(function(){ boot(); }, 1000);
    })();
    "#;
    let _ = window.eval(js);
}

struct Bridge {
    _child: Child,
    stdin: std::io::BufWriter<std::process::ChildStdin>,
    stdout: BufReader<std::process::ChildStdout>,
}
static BRIDGE: Mutex<Option<Bridge>> = Mutex::new(None);
static HOME: Mutex<String> = Mutex::new(String::new());

fn spawn_bridge(url: &str) {
    let bridge_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tools").join("bridge.mjs");
    let mut cmd = Command::new("node");
    cmd.arg(&bridge_path)
        .arg(url)
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().expect("failed to spawn bridge");
    let stdout = child.stdout.take().expect("bridge stdout");
    let stdin = child.stdin.take().expect("bridge stdin");
    let mut stderr = child.stderr.take().expect("bridge stderr");
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match stderr.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => { eprintln!("[bridge] {}", String::from_utf8_lossy(&buf[..n])); }
                Err(_) => break,
            }
        }
    });
    let b = Bridge {
        _child: child,
        stdin: std::io::BufWriter::new(stdin),
        stdout: BufReader::new(stdout),
    };
    *BRIDGE.lock().unwrap() = Some(b);
}

#[tauri::command]
fn bridge_call(op: String, args: serde_json::Value) -> Result<serde_json::Value, String> {
    use std::io::Write;
    let mut g = BRIDGE.lock().map_err(|e| e.to_string())?;
    let b = g.as_mut().ok_or("no bridge")?;
    let id = format!("{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let mut obj = serde_json::json!({"id": id, "op": op});
    if let Some(map) = args.as_object() {
        for (k, v) in map {
            obj[k.clone()] = v.clone();
        }
    }
    writeln!(b.stdin, "{}", obj).map_err(|e| e.to_string())?;
    b.stdin.flush().map_err(|e| e.to_string())?;
    // read until we get the matching response (skip events)
    loop {
        let mut line = String::new();
        let n = b.stdout.read_line(&mut line).map_err(|e| e.to_string())?;
        if n == 0 { return Err("bridge closed".into()); }
        let v: serde_json::Value = serde_json::from_str(line.trim()).map_err(|e| e.to_string())?;
        if v.get("id").and_then(|x| x.as_str()) == Some(&id) {
            if v.get("ok").and_then(|x| x.as_bool()) == Some(false) {
                return Err(v.get("error").and_then(|x| x.as_str()).unwrap_or("bridge error").to_string());
            }
            return Ok(v.get("value").cloned().unwrap_or(serde_json::Value::Null));
        }
    }
}

fn main() {
    // WebView2 anti-aliases its rounded window corners against its default
    // background (white), leaking light pixels at the corners on dark windows.
    std::env::set_var("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0F1115");

    tauri::Builder::default()
        // Must be the first plugin. A second launch hands focus to the running
        // instance and exits before spawning a host, a bridge, or a second
        // WebView2 that would fight over the shared profile and leave a
        // headless process behind.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                if w.is_visible().unwrap_or(false) {
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                    return;
                }
            }
            if let Some(w) = app.get_webview_window("welcome") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        // GitHub Releases updater. The endpoint and public key live in
        // tauri.conf.json; the UI check is injected from SHELL_JS.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![bridge_call])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                eprintln!("[deepr] window destroyed: {}", window.label());
                let app = window.app_handle();
                match window.label() {
                    // Main is the app; if it closes, quit instead of lingering headless.
                    "main" => app.exit(0),
                    // Welcome window destroyed: if main is visible, user moved on to the app;
                    // if main is NOT visible, user closed welcome via X or Alt+F4 -> quit.
                    "welcome" => {
                        if let Some(m) = app.get_webview_window("main") {
                            if !m.is_visible().unwrap_or(false) {
                                app.exit(0);
                            }
                        } else {
                            app.exit(0);
                        }
                    }
                    _ => {}
                }
            }
        })
        .setup(move |tauri_app| {
            let app = tauri_app.handle().clone();

            // Spawn host + bridge here (after single-instance check) so a
            // duplicate launch never starts a second host or bridge.
            purge_stale_cookies();
            let (child, url) = spawn_host(stored_key().as_deref());
            let _host = Arc::new(Mutex::new(Some(child)));
            *HOME.lock().unwrap() = url.clone();
            spawn_bridge(&url);

            let main = WebviewWindowBuilder::new(&app, "main", WebviewUrl::App("index.html".into()))
                .title("Melatonyne")
                .inner_size(1280.0, 820.0)
                .min_inner_size(520.0, 600.0)
                .decorations(false)
                .visible(false)
                .shadow(false)
                .background_color(tauri::window::Color(15, 17, 21, 255))
                .initialization_script(SHELL_JS)
                .initialization_script(POLISH_JS)
                .on_page_load(|webview, _payload| {
                    // Init scripts only prove out on the first document in this
                    // WebView2 build. Re-apply on every load event: Started
                    // paints the titlebar vars before first paint, Finished
                    // restores the full payload once the DOM exists. No timers.
                    let _ = webview.eval(SHELL_JS);
                    let _ = webview.eval(POLISH_JS);
                })
                .on_navigation(move |url| {
                    let s = url.as_str();
                    let allowed = s.starts_with("http://127.0.0.1")
                        || s.starts_with("http://tauri.localhost")
                        || s.starts_with("tauri://");
                    if allowed {
                        return true;
                    }
                    // Platform sign-in and external links open in the system browser, not the app frame.
                    open_external(s);
                    false
                })
                .build()
                .expect("failed to build main window");
            let _ = main.set_theme(Some(tauri::Theme::Dark));
            let icon_bytes = include_bytes!("../icons/icon.png");
            if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                let _ = main.set_icon(icon);
            }

            stage_welcome();
            let welcome = WebviewWindowBuilder::new(
                &app,
                "welcome",
                WebviewUrl::App(format!(
                    "__dsh-welcome/renderer/index.html?v={}",
                    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()
                ).into()),
            )
            .title("Melatonyne")
            .inner_size(600.0, 700.0)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .decorations(false)
            .shadow(false)
            .background_color(tauri::window::Color(15, 17, 21, 255))
            .build()
            .expect("failed to build welcome window");
            set_border_color(&welcome);
            set_border_color(&main);


            {
                let a = app.clone();
                app.listen_any("deepr-close", move |_e| {
                    a.exit(0);
                });
            }
            {
                app.listen_any("deepr-key", move |e| {
                    let value = e.payload().trim().trim_matches('"').to_string();
                    if !value.is_empty() {
                        store_key(&value);
                    }
                });
            }
            {
                app.listen_any("deepr-open-url", move |e| {
                    let u = e.payload().trim().trim_matches('"').to_string();
                    eprintln!("[deepr] open-url {}", u);
                    if u.starts_with("http://") || u.starts_with("https://") {
                        open_external(&u);
                    }
                });
            }

            let parsed = url::Url::parse(&HOME.lock().unwrap().clone()).expect("host URL parses");
            let window_clone = main.clone();
            std::thread::spawn(move || {
                for _ in 0..60 {
                    if window_clone.url().map(|u| u.scheme() == "http").unwrap_or(false) { break; }
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
                std::thread::sleep(std::time::Duration::from_secs(3));
                // Belt and braces: initialization scripts cover reloads; these
                // retry evals cover an ordering race where our script ran before
                // the Tauri IPC bundle inside the very first commit. Idempotent.
                let _ = window_clone.eval(SHELL_JS);
                let _ = window_clone.eval(POLISH_JS);
            });
            // Watchdog removed: the initialization scripts + the one-shot eval
            // above are enough. The harness itself now owns updates.

            main.navigate(parsed).expect("navigate to host URL");

            {
                let wl = welcome.clone();
                std::thread::spawn(move || {
                    for _ in 0..40 {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        welcome_clicks(&wl);
                    }
                });
            }

            {
                let main = main.clone();
                let welcome = welcome.clone();
                app.listen_any("deepr-continue", move |e| {
                    let _came_from_signin = e.payload().contains("signed-in");
                    eprintln!("[deepr] continue payload={}", e.payload());
                    let _ = main.show();
                    let _ = main.set_focus();
                    let _ = welcome.close();
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

