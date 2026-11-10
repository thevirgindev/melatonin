p = 'src/main.rs'
s = open(p, encoding='utf-8').read()
needle = """      if (!window.__deeprGS) {"""
assert needle in s
code = """      if (!window.__melUpdate) {
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
"""
s = s.replace(needle, code + needle)
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
