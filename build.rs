use std::path::{Path, PathBuf};

/// Stage the welcome renderer into the embedded dist and the vendored backend.
fn stage_welcome() {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("welcome");
    let targets = [
        Path::new(env!("CARGO_MANIFEST_DIR")).join("dist").join("__dsh-welcome"),
        Path::new(r"C:\Users\user\Documents\smth-new\harness\apps\web\dist").join("__dsh-welcome"),
    ];
    for dst in &targets {
        for sub in ["lib/welcome", "renderer", "renderer/assets"] {
            let _ = std::fs::create_dir_all(dst.join(sub));
            if let Ok(entries) = std::fs::read_dir(src.join(sub)) {
                for e in entries.flatten() {
                    let _ = std::fs::copy(e.path(), dst.join(sub).join(e.file_name()));
                }
            }
        }
    }
}

/// Copy the WebView2 loader next to the built exe. Without it Windows resolves
/// WebView2Loader.dll through PATH and any third-party copy (Cloudflare WARP
/// ships one in C:\Program Files\Cloudflare\Cloudflare WARP) shadows it, which
/// kills the process at load with STATUS_ENTRYPOINT_NOT_FOUND (0xC0000139).
fn stage_webview2_loader() {
    let out_dir = match std::env::var("OUT_DIR") {
        Ok(v) => PathBuf::from(v),
        Err(_) => return,
    };
    // OUT_DIR = <target>/<profile>/build/<pkg>-<hash>/out
    let exe_dir = match out_dir.ancestors().nth(3) {
        Some(p) => p.to_path_buf(),
        None => return,
    };
    if exe_dir.join("WebView2Loader.dll").exists() {
        return;
    }
    let cargo_home = std::env::var("USERPROFILE")
        .map(|p| PathBuf::from(p).join(".cargo"))
        .unwrap_or_default();
    let registry = cargo_home.join("registry").join("src");
    let mut found: Option<PathBuf> = None;
    if let Ok(hosts) = std::fs::read_dir(&registry) {
        for host in hosts.flatten() {
            if let Ok(crates) = std::fs::read_dir(host.path()) {
                for c in crates.flatten() {
                    let name = c.file_name().to_string_lossy().to_string();
                    if name.starts_with("webview2-com-sys-") {
                        let candidate = c.path().join("x64").join("WebView2Loader.dll");
                        if candidate.exists() {
                            found = Some(candidate);
                        }
                    }
                }
            }
        }
    }
    if let Some(loader) = found {
        let _ = std::fs::copy(loader, exe_dir.join("WebView2Loader.dll"));
    }
}

fn main() {
    stage_welcome();
    stage_webview2_loader();
    tauri_build::build();
}
