p = 'src/main.rs'
s = open(p, encoding='utf-8').read()
needle = """        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {"""
assert needle in s
# find end of that plugin call: the closing "}))" followed by newline
start = s.index(needle)
end_marker = '        }))\n'
end = s.index(end_marker, start) + len(end_marker)
add = """        // GitHub Releases updater. The endpoint and public key live in
        // tauri.conf.json; the UI check is injected from SHELL_JS.
        .plugin(tauri_plugin_updater::Builder::new().build())
"""
s = s[:end] + add + s[end:]
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
