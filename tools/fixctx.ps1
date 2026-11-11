$src = 'deepr-tauri\src\main.rs'
$c = Get-Content $src -Raw -Encoding UTF8
$a = '[data-windows-titlebar] placeholder'
$b1 = "        b.style.cssText = 'padding:7px 14px;font-size:13px;color:#f9fafb;cursor:default;white-space:nowrap;font-family:inherit;';"
$a1 = "        b.style.cssText = 'height:26px;line-height:26px;padding:0 12px;font-size:13px;color:#f9fafb;cursor:default;white-space:nowrap;font-family:inherit;border-radius:6px;';"
$b2 = "cm.style.cssText = 'position:fixed;z-index:2147483646;min-width:180px;padding:6px;border-radius:10px;background:rgb(30,30,32);border:1px solid rgba(255,255,255,0.12);box-shadow:0 12px 32px rgba(0,0,0,0.5);';"
$a2 = "cm.style.cssText = 'position:fixed;z-index:2147483646;min-width:150px;padding:4px;border-radius:8px;background:rgb(28,28,31);border:0.5px solid rgba(255,255,255,0.14);box-shadow:0 8px 20px rgba(0,0,0,0.38);';"
$b3 = "        sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.1);margin:5px 8px;';"
$a3 = "        sep.style.cssText = 'height:0.5px;background:rgba(255,255,255,0.12);margin:3px 6px;';"
$b4 = "cm.appendChild(ctxItem('Save as…', function(){ W && W.saveDialog ? W.saveDialog() : location.reload(); }));"
$remove = ""
$c = $c.Replace($b1, $a1).Replace($b2, $a2).Replace($b3, $a3).Replace($b4, '')
[IO.File]::WriteAllText((Resolve-Path $src), $c, [System.Text.UTF8Encoding]::new($false))
Select-String -Path $src -Pattern 'ctxItem\(' | ForEach-Object { "$($_.LineNumber)" }
