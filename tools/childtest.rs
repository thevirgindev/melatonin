use std::process::Command;

fn main() {
    let js = r#"
const fs=require('fs'), os=require('os');
const targets=[['temp',os.tmpdir()+'\\ct-temp.txt'],['workspace','C:\\Users\\user\\Documents\\smth-new\\deepr-tauri\\tools\\ct-ws.txt'],['dsh',process.env.USERPROFILE+'\\.dsh\\ct.txt'],['localappdata',process.env.LOCALAPPDATA+'\\ct-la.txt']];
for (const [n,p] of targets){ try{fs.writeFileSync(p,'x');console.log(n,'ok')}catch(e){console.log(n,e.code||e.message)} }
"#;
    let out = Command::new("node").args(["-e", js]).output().expect("spawn node");
    println!("stdout:\n{}", String::from_utf8_lossy(&out.stdout));
    println!("stderr:\n{}", String::from_utf8_lossy(&out.stderr));
}
