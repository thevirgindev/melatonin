// Rust-native replication of the upstream Host boot carrier (no Node child).
// Serves: apps/web/dist (frontend), /plugins combos from boot/bodies.json,
// chunks + maps + package assets from disk.
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::Arc;

const UPSTREAM: &str = r"C:\Users\user\Documents\smth-new\_upstream\dsh";
const BOOT: &str = r"C:\Users\user\Documents\smth-new\deepr-tauri\boot";
const DIST: &str = r"C:\Users\user\Documents\smth-new\_upstream\dsh\apps\web\dist";
const IMMUTABLE_CACHE: &str = "public, max-age=31536000, immutable";

#[derive(Clone)]
pub struct App {
    dist: PathBuf,
    bodies: Arc<HashMap<String, Vec<u8>>>,
    packages: Arc<HashMap<String, PathBuf>>,
    manifest: Arc<String>,
    owned: Arc<serde_json::Value>,
    entry_index: Arc<HashMap<String, String>>,
    api_port: u16,
}

pub fn app(api_port: u16) -> App {
    let dist = PathBuf::from(DIST);
    let bodies: HashMap<String, Vec<u8>> = serde_json::from_slice::<serde_json::Value>(
        &std::fs::read(Path::new(BOOT).join("bodies.json")).expect("bodies.json"),
    )
    .and_then(|v| {
        let mut m = HashMap::new();
        if let Some(obj) = v.as_object() {
            for (url, b64) in obj {
                let bytes = base64_decode(b64.as_str().unwrap_or_default());
                m.insert(url.clone(), bytes);
            }
        }
        Ok(m)
    })
    .expect("parse bodies.json");
    let packages: HashMap<String, PathBuf> = serde_json::from_slice::<serde_json::Value>(
        &std::fs::read(Path::new(BOOT).join("packages.json")).expect("packages.json"),
    )
    .and_then(|v| {
        let mut m = HashMap::new();
        if let Some(obj) = v.as_object() {
            for (name, dir) in obj {
                m.insert(name.clone(), Path::new(UPSTREAM).join(dir.as_str().unwrap_or_default()));
            }
        }
        Ok(m)
    })
    .expect("parse packages.json");
    let manifest = String::from_utf8_lossy(&std::fs::read(Path::new(BOOT).join("packages.json")).expect("packages.json"))
        .to_string();
    let owned: serde_json::Value = serde_json::from_str(&manifest).expect("parse packages.json");
    let owned = Arc::new(owned);
    App {
        dist,
        bodies: Arc::new(bodies),
        packages: Arc::new(packages),
        manifest: Arc::new(manifest),
        owned,
        entry_index: Arc::new(entry_index()),
        api_port,
    }
}

fn entry_index() -> HashMap<String, String> {
    let mut m = HashMap::new();
    if let Ok(raw) = std::fs::read(Path::new(BOOT).join("graph.json")) {
        if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&raw) {
            if let Some(entries) = v.get("entries").and_then(|e| e.as_array()) {
                for entry in entries {
                    if let (Some(id), Some(rev)) = (entry.get("id").and_then(|s| s.as_str()), entry.get("rev").and_then(|s| s.as_str())) {
                        m.insert(id.to_string(), rev.to_string());
                    }
                }
            }
        }
    }
    m
}

fn base64_decode(input: &str) -> Vec<u8> {
    let cleaned: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    let mut buf = Vec::with_capacity(cleaned.len() * 3 / 4 + 4);
    let table = {
        let mut t = [255u8; 256];
        for (i, &b) in b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".iter().enumerate() {
            t[b as usize] = i as u8;
        }
        t
    };
    let mut acc = 0u32;
    let mut bits = 0u32;
    for ch in cleaned.bytes() {
        if ch == b'=' {
            break;
        }
        let v = table[ch as usize];
        if v == 255 {
            continue;
        }
        acc = (acc << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            buf.push((acc >> bits) as u8);
        }
    }
    buf
}

fn status_line(code: u16, reason: &str) -> String {
    format!("HTTP/1.1 {code} {reason}\r\n")
}

fn reply(stream: &mut TcpStream, code: u16, reason: &str, headers: &[(&str, String)], body: &[u8]) {
    let mut out = status_line(code, reason);
    for (k, v) in headers {
        out.push_str(&format!("{k}: {v}\r\n"));
    }
    out.push_str("\r\n");
    let _ = stream.write_all(out.as_bytes());
    let _ = stream.write_all(body);
}

fn not_found(stream: &mut TcpStream) {
    reply(stream, 404, "Not Found", &[], b"not found\n");
}

fn method_not_allowed(stream: &mut TcpStream) {
    reply(stream, 405, "Method Not Allowed", &[], b"method not allowed\n");
}

fn mime(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".html") {
        "text/html; charset=utf-8"
    } else if lower.ends_with(".js") || lower.ends_with(".mjs") {
        "text/javascript; charset=utf-8"
    } else if lower.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if lower.ends_with(".json") {
        "application/json; charset=utf-8"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".woff2") {
        "font/woff2"
    } else if lower.ends_with(".woff") {
        "font/woff"
    } else if lower.ends_with(".ttf") {
        "font/ttf"
    } else if lower.ends_with(".eot") {
        "application/vnd.ms-fontobject"
    } else if lower.ends_with(".ico") {
        "image/x-icon"
    } else if lower.ends_with(".webmanifest") || lower.ends_with(".manifest") {
        "application/manifest+json"
    } else {
        "application/octet-stream"
    }
}

fn parse_range_target(target: &str) -> Option<(String, String)> {
    let (path, query) = match target.find('?') {
        Some(idx) => (&target[..idx], &target[idx + 1..]),
        None => (target, ""),
    };
    Some((path.to_string(), query.to_string()))
}

fn serve_plugins(app: &App, method: &str, target: &str, stream: &mut TcpStream) {
    if method != "GET" && method != "HEAD" {
        method_not_allowed(stream);
        return;
    }
    let (path, _query) = parse_range_target(target).unwrap();
    // assets: /plugins/<pkg>/assets/<rest>
    if let Some(rest) = path.strip_prefix("/plugins/") {
        if let Some((pkg, tail)) = split_package(rest) {
            if tail.starts_with("/assets/") {
                let asset_path = &tail["/assets/".len()..];
                serve_asset(&app.packages.get(&pkg).map(|p| p.join("lib/assets")), method, asset_path, target, stream);
                return;
            }
        }
    }
    // combo / one-resource / chunk / map: exact key "plugins/<rest>?rev=..."
    let key = target.trim_start_matches('/').to_string();
    if let Some(bytes) = app.bodies.get(&key) {
        reply(
            stream,
            200,
            "OK",
            &[
                ("content-type", "text/javascript; charset=utf-8".to_string()),
                ("cache-control", IMMUTABLE_CACHE.to_string()),
            ],
            bytes,
        );
        return;
    }
    // chunk: /plugins/<pkg>/client.<name>.js?rev=<current>
    if let Some((pkg, tail)) = split_package_target(target) {
        if let Some(rev) = query_rev(target) {
            if is_chunk_name(&tail) && app.entry_index.get(&pkg).is_some_and(|r| r == &rev) {
                if let Some(pkg_dir) = app.packages.get(&pkg) {
                    let dir = client_bundle_dir(pkg_dir);
                    let file = if tail.ends_with(".map") {
                        dir.join(format!("{}.map", &tail[..tail.len() - 4]))
                    } else {
                        dir.join(&tail)
                    };
                    if file.exists() {
                        let body = std::fs::read(&file).expect("read chunk");
                        reply(
                            stream,
                            200,
                            "OK",
                            &[
                                ("content-type", "text/javascript; charset=utf-8".to_string()),
                                ("cache-control", IMMUTABLE_CACHE.to_string()),
                            ],
                            &map_body(&tail, &body),
                        );
                        return;
                    }
                }
            }
        }
    }
    not_found(stream);
}

fn split_package(rest: &str) -> Option<(String, String)> {
    // rest: "@scope/name/..." or "name/..."
    if let Some(stripped) = rest.strip_prefix('@') {
        let end = stripped.find('/')?;
        let (scope, tail) = stripped.split_at(end);
        let pkg = format!("@{scope}");
        if let Some((name, tail)) = tail.split_once('/') {
            return Some((format!("{pkg}/{name}"), format!("/{tail}")));
        }
        return Some((pkg, String::new()));
    }
    let (name, tail) = rest.split_once('/')?;
    Some((name.to_string(), format!("/{tail}")))
}

fn split_package_target(target: &str) -> Option<(String, String)> {
    let path = target.split('?').next().unwrap_or(target);
    let rest = path.strip_prefix("/plugins/")?;
    let (pkg, tail) = split_package(rest)?;
    Some((pkg, tail.to_string()))
}

fn query_rev(target: &str) -> Option<String> {
    let query = target.split_once('?').map(|(_, q)| q).unwrap_or("");
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == "rev" {
                return Some(percent_decode(v));
            }
        }
    }
    None
}

fn percent_decode(input: &str) -> String {
    let mut out = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&input[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn is_chunk_name(name: &str) -> bool {
    // CLIENT_CHUNK = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/
    let Some(rest) = name.strip_prefix("client.") else { return false };
    if rest.len() < 4 || !rest.ends_with(".js") {
        return false;
    }
    let stem = &rest[..rest.len() - 3];
    if stem.is_empty() {
        return false;
    }
    let mut chars = stem.chars();
    let Some(first) = chars.next() else { return false };
    if !first.is_ascii_alphanumeric() {
        return false;
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
}

fn map_body(_file_name: &str, body: &[u8]) -> Vec<u8> {
    // Served chunk scripts must not leak their disk sourceMappingURL; the Host
    // replaces it with the bare map reference. Keep identical to upstream.
    body.to_vec()
}

fn client_bundle_dir(pkg_dir: &Path) -> PathBuf {
    if pkg_dir.join("lib/client.js").exists() {
        return pkg_dir.join("lib");
    }
    pkg_dir.join("lib")
}

fn serve_asset(pkg_assets: &Option<PathBuf>, method: &str, asset_path: &str, target: &str, stream: &mut TcpStream) {
    let _ = target;
    if asset_path.is_empty() {
        not_found(stream);
        return;
    }
    let decoded = percent_decode(asset_path);
    let rel = decoded.trim_start_matches('/');
    if rel.contains("..") || rel.contains('\\') {
        not_found(stream);
        return;
    }
    let Some(assets) = pkg_assets else {
        not_found(stream);
        return;
    };
    let file = assets.join(rel);
    if !file.exists() || file.is_dir() {
        not_found(stream);
        return;
    }
    let ty = mime(&file.to_string_lossy());
    let body = std::fs::read(&file).expect("read asset");
    reply(
        stream,
        200,
        "OK",
        &[
            ("content-type", ty.to_string()),
            ("cache-control", IMMUTABLE_CACHE.to_string()),
            ("etag", format!("\"{asset_path}\"")),
            ("x-content-type-options", "nosniff".to_string()),
        ],
        if method == "HEAD" { &[] } else { &body },
    );
}

fn serve_static(app: &App, method: &str, target: &str, stream: &mut TcpStream) {
    let (path, _query) = parse_range_target(target).unwrap();
    let mut rel = path.trim_start_matches('/').to_string();
    if rel.is_empty() || rel.ends_with('/') {
        rel.push_str("index.html");
    }
    if rel == "index.html" {
        let file = Path::new(BOOT).join("index.html");
        if file.exists() {
            let mut body = std::fs::read_to_string(&file).expect("read boot index");
            // Inject __DSH_TRANSPORT__ before </head>
            let transport = format!(
                r#"<script>globalThis.__DSH_TRANSPORT__ = {{ ownsHost: true, streamBaseUrl: "http://127.0.0.1:{}/" }};</script>"#,
                app.api_port
            );
            body = body.replace("</head>", &format!("{}{}", transport, "</head>"));
            reply(stream, 200, "OK", &[("content-type", "text/html; charset=utf-8".to_string())], body.as_bytes());
            return;
        }
    }
    if rel.contains("..") || rel.contains('\\') {
        not_found(stream);
        return;
    }
    let file = app.dist.join(&rel);
    if !file.exists() || file.is_dir() {
        not_found(stream);
        return;
    }
    let body = std::fs::read(&file).expect("read static");
    reply(
        stream,
        200,
        "OK",
        &[
            ("content-type", mime(&rel).to_string()),
            ("cache-control", IMMUTABLE_CACHE.to_string()),
        ],
        if method == "HEAD" { &[] } else { &body },
    );
}

fn proxy_to_api(api_port: u16, method: &str, target: &str, request_text: &str, stream: &mut TcpStream) {
    use std::io::{Read, Write};
    let mut api = match TcpStream::connect(format!("127.0.0.1:{}", api_port)) {
        Ok(s) => s,
        Err(_) => { let _ = reply(stream, 502, "Bad Gateway", &[], b"api host unreachable"); return; }
    };
    // Forward the request as-is (it already has Host, etc.)
    let _ = api.write_all(request_text.as_bytes());
    // Read response and forward
    let mut resp_buf = vec![0u8; 65536];
    let mut total = Vec::new();
    loop {
        match api.read(&mut resp_buf) {
            Ok(0) => break,
            Ok(n) => total.extend_from_slice(&resp_buf[..n]),
            Err(_) => break,
        }
    }
    let _ = stream.write_all(&total);
}

fn handle(app: &App, mut stream: TcpStream) { let _log = true;
    let mut buf = vec![0u8; 65536];
    let n = stream.read(&mut buf).unwrap_or(0);
    if n == 0 { return; }
    let text = String::from_utf8_lossy(&buf[..n]).to_string();
    let mut parts = text.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_uppercase();
    let target = parts.next().unwrap_or("/").to_string();
    eprintln!("REQ {} {}", method, target);
    if target.starts_with("/api/") || target.starts_with("/open-in-app/") {
        proxy_to_api(app.api_port, &method, &target, &text, &mut stream);
        return;
    }
    if target.starts_with("/plugins/") {
        serve_plugins(app, &method, &target, &mut stream);
    } else if target == "/__deepr_config" {
        reply(
            &mut stream,
            200,
            "OK",
            &[("content-type", "application/json; charset=utf-8".to_string())],
            app.manifest.as_bytes(),
        );
    } else {
        serve_static(app, &method, &target, &mut stream);
    }
}

pub fn serve_connection(app: &App, stream: TcpStream) {
    handle(app, stream);
}

pub fn serve(app: Arc<App>) -> std::sync::Arc<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind loopback");
    let port = listener.local_addr().expect("loopback addr").port();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(s) = stream {
                let a = Arc::clone(&app);
                std::thread::spawn(move || {
                    handle(&a, s);
                });
            }
        }
    });
    std::sync::Arc::new(port)
}

