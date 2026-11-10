p = 'src/main.rs'
s = open(p, encoding='utf-8').read()

# 1) global HOME
s = s.replace(
  'static BRIDGE: Mutex<Option<Bridge>> = Mutex::new(None);',
  'static BRIDGE: Mutex<Option<Bridge>> = Mutex::new(None);\nstatic HOME: Mutex<String> = Mutex::new(String::new());'
)

# 2) remove spawn block from main()
old_main = """    std::env::set_var("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0F1115");
    purge_stale_cookies();
    let (child, url) = spawn_host(stored_key().as_deref());
    let _host = Arc::new(Mutex::new(Some(child)));
    let home = Arc::new(Mutex::new(String::new()));
    *home.lock().unwrap() = url.clone();
    spawn_bridge(&url);

    tauri::Builder::default()"""
new_main = """    std::env::set_var("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0F1115");

    tauri::Builder::default()"""
assert old_main in s
s = s.replace(old_main, new_main)

# 3) inject spawn into setup, after let app = ...clone();
old_setup = """            let app = tauri_app.handle().clone();

            let main = WebviewWindowBuilder::new(&app, "main", WebviewUrl::App("index.html".into()))"""
new_setup = """            let app = tauri_app.handle().clone();

            // Spawn host + bridge here (after single-instance check) so a
            // duplicate launch never starts a second host or bridge.
            purge_stale_cookies();
            let (child, url) = spawn_host(stored_key().as_deref());
            let _host = Arc::new(Mutex::new(Some(child)));
            *HOME.lock().unwrap() = url.clone();
            spawn_bridge(&url);

            let main = WebviewWindowBuilder::new(&app, "main", WebviewUrl::App("index.html".into()))"""
assert old_setup in s
s = s.replace(old_setup, new_setup)

# 4) thread read
s = s.replace(
  'let parsed = url::Url::parse(&home.lock().unwrap().clone()).expect("host URL parses");',
  'let parsed = url::Url::parse(&HOME.lock().unwrap().clone()).expect("host URL parses");'
)

open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
