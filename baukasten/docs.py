#!/usr/bin/env python3
"""Erzeugt den Ordner docs/ für GitHub Pages (Einstellungen → Pages → Branch main, Ordner /docs).
Alles sind Einzeldateien ohne Server. Büro und Handy gleichen sich im selben Browser ab (Reiter nebeneinander)."""
import pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parent.parent
py=sys.executable
subprocess.check_call([py,str(root/'baukasten/einbetten.py')])
subprocess.check_call([py,str(root/'baukasten/standalone.py'),str(root/'kunden/ludwig-hammer/standalone.json'),str(root/'kunden/ludwig-hammer/ludwig-hammer-standalone.html')])
subprocess.check_call([py,str(root/'baukasten/standalone.py'),str(root/'kunden/bautest/kunde.json'),str(root/'kunden/bautest/bautest-app.html')])
d=root/'docs'
for sub,src in [('studio','baukasten/richtwerk-studio.html'),('hammer','kunden/ludwig-hammer/ludwig-hammer-standalone.html'),('bautest','kunden/bautest/bautest-app.html')]:
    (d/sub).mkdir(parents=True,exist_ok=True)
    html=(root/src).read_text(encoding='utf-8')
    if '<meta name="viewport"' not in html:
        html='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+html+'\n</body></html>'
    (d/sub/'index.html').write_text(html,encoding='utf-8')
import shutil
w=d/'website';(w/'img').mkdir(parents=True,exist_ok=True)
subprocess.check_call([py,str(root/'baukasten/website.py')])
src=(root/'kunden/website/richtwerk-website-pages.html').read_text(encoding='utf-8')
if '<meta name="viewport"' not in src:
    src='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'+src+'\n</body></html>'
(w/'index.html').write_text(src,encoding='utf-8')
for f in (root/'kunden/website/img').glob('*.svg'):shutil.copy(f,w/'img'/f.name)
logo='<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0C1424"/><path d="M21 50V14.5H34a9.5 9.5 0 010 19H21" fill="none" stroke="#6F94FF" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 34L46 50" fill="none" stroke="#FF6B3D" stroke-width="8.5" stroke-linecap="round"/></svg>'
html_index='''<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Richtwerk</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter:wght@400;500;600&display=swap">
<style>
:root{--ink:#fff;--muted:rgba(255,255,255,.72)}
*{box-sizing:border-box}html,body{min-height:100%}
body{margin:0;background:#070b16;color:var(--ink);font:16px/1.55 Inter,system-ui,sans-serif;overflow-x:hidden;padding:max(22px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) 56px max(18px,env(safe-area-inset-left));transition:opacity .45s,transform .6s cubic-bezier(.2,.8,.2,1),filter .6s}
body.leave{opacity:0;transform:scale(1.12);filter:blur(10px)}
.blob{position:fixed;border-radius:50%;filter:blur(80px);z-index:0;animation:drift 20s ease-in-out infinite alternate}
.b1{width:560px;height:560px;background:#2457f5;left:-160px;top:-140px;opacity:.8}.b2{width:480px;height:480px;background:#ff6b3d;right:-120px;bottom:-140px;opacity:.7;animation-delay:-7s}.b3{width:420px;height:420px;background:#7a4dff;left:40%;top:35%;opacity:.5;animation-delay:-12s}
@keyframes drift{to{transform:translate(80px,-60px) scale(1.2)}}
main{position:relative;z-index:1;max-width:1000px;margin:0 auto;animation:rise .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(24px) scale(.98)}}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8vh}
.logo{display:flex;align-items:center;gap:12px;font:800 28px "Bricolage Grotesque",Inter,sans-serif;letter-spacing:-.04em}
.dev{font:500 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#fff;text-decoration:none;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(10px);padding:8px 12px;border-radius:999px;opacity:.7;transition:opacity .2s}.dev:hover{opacity:1}
h1{font:800 clamp(40px,8vw,84px)/1 "Bricolage Grotesque",Inter,sans-serif;letter-spacing:-.035em;margin:0 0 16px}
.lead{color:var(--muted);max-width:36em;font-size:18px;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:48px}
.card{display:block;text-decoration:none;color:inherit;padding:26px;border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.06));border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(26px) saturate(1.5);box-shadow:0 24px 60px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}
.card:hover{transform:translateY(-6px) scale(1.015);box-shadow:0 34px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.4)}
.mk{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;font:800 19px "Bricolage Grotesque",sans-serif;margin-bottom:16px}
.card b{display:block;font:700 24px/1.1 "Bricolage Grotesque",Inter,sans-serif;letter-spacing:-.02em}.card small{display:block;color:var(--muted);margin-top:6px;font-size:14.5px}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.chips a{color:#fff;text-decoration:none;padding:8px 15px;border-radius:999px;font:600 13.5px Inter,sans-serif;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25)}.chips a:hover{background:rgba(255,255,255,.3)}
.hint{margin-top:44px;color:var(--muted);font-size:14px;max-width:44em}
@media(prefers-reduced-motion:reduce){.blob,main{animation:none}body{transition:none}}
</style></head><body><i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><main>
<div class="top"><div class="logo">__LOGO__richtwerk</div><a class="dev" href="studio/">Entwicklertool</a></div>
<h1>Wähle deinen Betrieb.</h1>
<p class="lead">Jeder Betrieb hat sein eigenes Büro-Tool und seine eigene Handy-App. Beides sind getrennte Teile, du wählst sie hier einzeln aus.</p>
<div class="grid">
 <div class="card"><div class="mk" style="background:#c8102e">LH</div><b>Ludwig Hammer</b><small>Dachdeckerei &amp; Zimmerei · Musterbetrieb mit Daten</small><div class="chips"><a href="hammer/">Büro-Tool</a><a href="hammer/#handy">Handy-App</a></div></div>
 <div class="card"><div class="mk" style="background:#2457f5">BT</div><b>Bautest</b><small>Leerer Testbetrieb · 2 Personen</small><div class="chips"><a href="bautest/">Büro-Tool</a><a href="bautest/#handy">Handy-App</a></div></div>
 <div class="card"><div class="mk" style="background:linear-gradient(135deg,#6f94ff,#ff6b3d)">R</div><b>Richtwerk Website</b><small>Die Seite für Handwerksbetriebe mit Erstgespräch</small><div class="chips"><a href="website/">Website öffnen</a></div></div>
</div>
<p class="hint">Büro und Handy gleichen sich im selben Browser ab: Öffne beide in zwei Reitern nebeneinander.</p>
</main><script>
document.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(!a||e.metaKey||e.ctrlKey||a.target)return;e.preventDefault();document.body.classList.add('leave');setTimeout(function(){location.href=a.href},420)});
window.addEventListener('pageshow',function(){document.body.classList.remove('leave')});
</script></body></html>'''
(d/'index.html').write_text(html_index.replace('__LOGO__',logo),encoding='utf-8')
print('docs/ erzeugt')
