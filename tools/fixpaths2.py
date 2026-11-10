p = 'src/main.rs'
s = open(p, encoding='utf-8').read()
s = s.replace('let dst = Path::new(DIST).join("__dsh-welcome");', 'let dst = dist_dir().join("__dsh-welcome");')
s = s.replace('.current_dir(UPSTREAM)', '.current_dir(backend())')
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('dist refs left:', s.count('DIST'), '| UPSTREAM refs:', s.count('UPSTREAM'))
