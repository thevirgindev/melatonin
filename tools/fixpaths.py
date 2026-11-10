p = 'src/main.rs'
s = open(p, encoding='utf-8').read()

old = '''const UPSTREAM: &str = r"C:\\Users\\user\\Documents\\smth-new\\vendor-backend\\dsh";
const DIST: &str = r"C:\\Users\\user\\Documents\\smth-new\\vendor-backend\\dsh\\apps\\web\\dist";'''
new = '''/// Backend root, resolved once at startup. Order: MELATONYNE_BACKEND env,
/// `backend\\dsh` next to the exe (portable install), then the dev checkout.
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
    std::path::PathBuf::from(r"C:\\Users\\user\\Documents\\smth-new\\vendor-backend\\dsh")
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
}'''
assert old in s, 'const block not found'
s = s.replace(old, new)
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
