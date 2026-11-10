p = 'tools/fix6.py'
s = open(p, encoding='utf-8').read()
start = s.index('        // Grow the window just enough')
end = s.index('        // One beat: sync typography/colors')
new = '''        // The welcome layout is bottom-anchored, so growing the window moves
        // the content 1:1 and never closes the gap. Instead: when the panel
        // expands, make the page scrollable and scroll the form into view so
        // it lives inside the window, same as the Add API Key screen.
        function reveal(){
          document.documentElement.style.overflowY = 'auto';
          document.body.style.overflowY = 'auto';
          var host = document.getElementById('deepr-provider');
          if (host) host.scrollIntoView({ block: 'nearest' });
        }
        function collapse(){
          document.documentElement.style.overflowY = '';
          document.body.style.overflowY = '';
          window.scrollTo(0, 0);
        }
'''
s = s[:start] + new + s[end:]
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok, len', len(s))
