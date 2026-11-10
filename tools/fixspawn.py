p = 'src/main.rs'
s = open(p, encoding='utf-8').read()
old = '''fn spawn_host(key: Option<&str>) -> (Child, String) {
    let mut cmd = Command::new("node");
    cmd.args([
        "--import",
        "tsx/esm",
        "apps/cli/src/bin.ts",
        "web",
        "--no-open",
        "--port",
        "0",
    ])
    .current_dir(backend())
    .env("DSH_BUILD_CLIENT_PROFILE", "official");'''
new = '''fn spawn_host(key: Option<&str>) -> (Child, String) {
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
        .env("DSH_BUILD_CLIENT_PROFILE", "official");'''
assert old in s
s = s.replace(old, new)
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
