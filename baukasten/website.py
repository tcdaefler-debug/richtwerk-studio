#!/usr/bin/env python3
"""Baut die Richtwerk-Website mit Betriebsauswahl (Liquid-Glas), Zoom-Übergang und kleinem Entwickler-Knopf.
Erzeugt kunden/website/richtwerk-website.html (für claude.ai) und docs/website/index.html (GitHub Pages)."""
import json,pathlib,re,sys
root=pathlib.Path(__file__).resolve().parent.parent
src=(root/'kunden/website/index.html').read_text(encoding='utf-8')
apps={'hammer':(root/'kunden/ludwig-hammer/ludwig-hammer-standalone.html').read_text(encoding='utf-8'),
      'bautest':(root/'kunden/bautest/bautest-app.html').read_text(encoding='utf-8')}
LINKS={'artifact':{'studio':'https://claude.ai/artifact/1938VsCy8FX7usfN5vuaDJ','hammer':'https://claude.ai/artifact/Ltov6R5BakHHkfSBqSpRzb','bautest':'https://claude.ai/artifact/126hE1e72nqCy6Jj8JdTKo'},
       'pages':{'studio':'../studio/','hammer':'../hammer/','bautest':'../bautest/'}}
CSS='''
.devbar{position:absolute;top:calc(env(safe-area-inset-top,0px) + 6px);right:max(14px,env(safe-area-inset-right,0px));z-index:40}
.devbar a{font:500 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;text-decoration:none;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(10px);padding:6px 10px;border-radius:999px;opacity:.7;transition:opacity .2s}
.devbar a:hover{opacity:1}
.nav{top:30px}
.demo{position:relative;overflow:hidden;margin:0 calc(-1*max(16px,env(safe-area-inset-left,0px)));padding:110px max(16px,env(safe-area-inset-left,0px));background:#070b16;color:#fff;isolation:isolate}
.demo .blob{position:absolute;border-radius:50%;filter:blur(70px);opacity:.75;z-index:-1;animation:drift 18s ease-in-out infinite alternate}
.demo .b1{width:520px;height:520px;background:#2457f5;left:-120px;top:-100px}
.demo .b2{width:460px;height:460px;background:#ff6b3d;right:-100px;bottom:-120px;animation-delay:-6s}
.demo .b3{width:380px;height:380px;background:#7a4dff;left:42%;top:30%;animation-delay:-11s;opacity:.55}
@keyframes drift{to{transform:translate(70px,-50px) scale(1.18)}}
.demo h2{margin:14px 0 10px;color:#fff}.demo .lead2{color:rgba(255,255,255,.72);max-width:40em}
.picks{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;margin-top:44px}
.pick{position:relative;text-align:left;font:inherit;color:#fff;cursor:pointer;padding:28px;border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.06));border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(26px) saturate(1.5);box-shadow:0 24px 60px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}
.pick:hover{transform:translateY(-6px) scale(1.015);box-shadow:0 34px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.4)}
.pick .mk{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font:800 20px var(--display);margin-bottom:18px;color:#fff}
.pick b{display:block;font:700 26px/1.1 var(--display);letter-spacing:-.02em}.pick small{display:block;margin-top:6px;color:rgba(255,255,255,.72);font-size:14.5px}
.pick .go{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}.pick .go span{padding:9px 16px;border-radius:999px;font:600 13.5px var(--body);background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25)}
.pick .go span:hover{background:rgba(255,255,255,.3)}
#stage{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;background:#070b16;color:#fff;visibility:hidden;opacity:0;transform-origin:0 0;will-change:transform,opacity,border-radius;overflow:hidden}
#stage.on{visibility:visible}
#stage .bar{display:flex;align-items:center;gap:12px;padding:10px max(14px,env(safe-area-inset-left,0px));padding-top:max(10px,env(safe-area-inset-top,0px));background:rgba(255,255,255,.08);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.14);flex-wrap:wrap}
#stage .bar button,#stage .bar a{font:600 13.5px var(--body);color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:8px 15px;cursor:pointer;text-decoration:none}
#stage .bar .seg{display:flex;gap:4px;margin-left:auto}#stage .bar .seg button[aria-pressed=true]{background:#fff;color:#0c1424}
#stage .bar .nm{font:700 16px var(--display)}
#stage .view{flex:1;display:grid;place-items:center;min-height:0;background:#e9e4e4}
#stage iframe{border:0;width:100%;height:100%;background:#fff}
#stage .view.ph{background:radial-gradient(circle at 30% 20%,#2457f5 0,transparent 50%),#0b1224}
#stage .view.ph iframe{width:min(400px,100%);height:min(860px,calc(100% - 24px));border-radius:34px;box-shadow:0 0 0 8px #0c1424,0 30px 80px rgba(0,0,0,.5)}
body.zoomed main,body.zoomed header.nav{transform:scale(.94);filter:blur(6px);opacity:.5;transition:all .5s cubic-bezier(.2,.8,.2,1)}
main,header.nav{transition:all .5s cubic-bezier(.2,.8,.2,1)}
@media(prefers-reduced-motion:reduce){.demo .blob{animation:none}#stage{transition:none!important}}
'''
DEMO='''<section id="demo" class="demo"><i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><div class="wrap">
 <p class="eyebrow" style="color:#9bb4ff">Live ausprobieren</p><h2>Such dir einen Betrieb aus.</h2>
 <p class="lead2">Wähle einen Beispielbetrieb und öffne Büro-Tool oder Handy-App. Das Büro-Tool und die Handy-App sind getrennte Teile und werden hier einzeln ausgewählt.</p>
 <div class="picks">
  <div class="pick" data-k="hammer" data-n="Ludwig Hammer" role="group" aria-label="Ludwig Hammer"><div class="mk" style="background:#c8102e">LH</div><b>Ludwig Hammer</b><small>Dachdeckerei &amp; Zimmerei · 12 Mitarbeiter · Musterdaten</small><div class="go"><span data-m="buero" role="button" tabindex="0">Büro-Tool öffnen</span><span data-m="handy" role="button" tabindex="0">Handy-App öffnen</span></div></div>
  <div class="pick" data-k="bautest" data-n="Bautest" role="group" aria-label="Bautest"><div class="mk" style="background:#2457f5">BT</div><b>Bautest</b><small>Leerer Testbetrieb · 2 Personen · zum Selbst-Einrichten</small><div class="go"><span data-m="buero" role="button" tabindex="0">Büro-Tool öffnen</span><span data-m="handy" role="button" tabindex="0">Handy-App öffnen</span></div></div>
 </div></div></section>
'''
STAGE='''<div id="stage" aria-hidden="true"><div class="bar"><button id="stBack">← Zurück zur Website</button><span class="nm" id="stNm"></span><div class="seg"><button data-sm="buero">Büro</button><button data-sm="handy">Handy</button></div><a id="stExt" target="_blank" rel="noopener">Live-Version im eigenen Tab ↗</a></div><div class="view" id="stView"><iframe id="stFrame" title="Vorschau" sandbox="allow-scripts allow-forms"></iframe></div></div>
<script>
(function(){
var APPS=/*APPS*/,LINKS=/*LINKS*/;
var st=document.getElementById('stage'),fr=document.getElementById('stFrame'),vw=document.getElementById('stView'),cur=null,origin=null;
var SHIM='<script>(function(){var cbs={},n=0;window.addEventListener("message",function(e){var d=e.data;if(!d||d.rw!==2)return;(cbs[d.path]||[]).forEach(function(f){f.ok({exists:d.exists,data:function(){return d.data}})})});window.claude={use:function(){return Promise.resolve({doc:function(p){return{set:function(v){parent.postMessage({rw:1,op:"set",path:p,data:v},"*");return Promise.resolve()},onSnapshot:function(ok,er){(cbs[p]=cbs[p]||[]).push({ok:ok});parent.postMessage({rw:1,op:"watch",path:p},"*");return function(){}}}}})}}})()<\/script>';
var dbp=null;try{dbp=(window.claude&&window.claude.use)?window.claude.use('db').then(function(d){if(!d)dbp=null;return d},function(){dbp=null;return null}):null}catch(e){dbp=null}
var watching={};
window.addEventListener('message',function(e){var d=e.data;if(!d||d.rw!==1||e.source!==fr.contentWindow||!cur||!dbp)return;
 var k=cur.k;dbp.then(function(db){var path='demo-'+k+'/'+d.path.replace(/\//g,'-');
  if(d.op==='set'){try{db.doc(path).set(d.data)}catch(x){}}
  else if(d.op==='watch'){if(watching[path])watching[path]();
   watching[path]=db.doc(path).onSnapshot(function(sn){try{fr.contentWindow.postMessage({rw:2,path:d.path,exists:sn.exists,data:sn.exists?sn.data():null},'*')}catch(x){}},function(){})}
 }).catch(function(){})});
function load(k,m){var h=APPS[k];if(dbp)h=SHIM+h;if(m==='handy')h='<script>location.hash="#handy"<\\/script>'+h;
 vw.classList.toggle('ph',m==='handy');fr.srcdoc=h;cur={k:k,m:m};
 document.querySelectorAll('[data-sm]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.sm===m))});
 var e=document.getElementById('stExt');e.href=LINKS[k]+(m==='handy'?'#handy':'');}
function rect(el){var r=el.getBoundingClientRect();return{x:r.left,y:r.top,sx:r.width/innerWidth,sy:r.height/innerHeight}}
function open(card,m){origin=card;var k=card.dataset.k;document.getElementById('stNm').textContent=card.dataset.n;load(k,m);
 var r=rect(card);st.classList.add('on');st.setAttribute('aria-hidden','false');
 st.style.transition='none';st.style.opacity='0';st.style.borderRadius='30px';st.style.transform='translate('+r.x+'px,'+r.y+'px) scale('+r.sx+','+r.sy+')';
 void st.offsetWidth;document.body.classList.add('zoomed');
 st.style.transition='transform .6s cubic-bezier(.2,.8,.2,1),opacity .35s,border-radius .6s';st.style.opacity='1';st.style.borderRadius='0';st.style.transform='none';document.body.style.overflow='hidden'}
function close(){var r=origin?rect(origin):{x:innerWidth/2,y:innerHeight/2,sx:.1,sy:.1};
 document.body.classList.remove('zoomed');st.style.transform='translate('+r.x+'px,'+r.y+'px) scale('+r.sx+','+r.sy+')';st.style.opacity='0';st.style.borderRadius='30px';
 setTimeout(function(){st.classList.remove('on');st.setAttribute('aria-hidden','true');fr.srcdoc='';document.body.style.overflow=''},600)}
document.querySelectorAll('.pick').forEach(function(c){
 c.addEventListener('click',function(e){var s=e.target.closest('[data-m]');open(c,s?s.dataset.m:'buero')});
 c.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){var s=e.target.closest('[data-m]');if(s){e.preventDefault();open(c,s.dataset.m)}}})});
document.getElementById('stBack').addEventListener('click',close);
document.querySelectorAll('[data-sm]').forEach(function(b){b.addEventListener('click',function(){load(cur.k,b.dataset.sm)})});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&st.classList.contains('on'))close()});
})();
</script>
'''
def build(mode):
    s=src
    L=LINKS[mode]
    s=s.replace('</style>',CSS+'</style>',1)
    s=s.replace('<header class="nav"','<div class="devbar"><a href="%s" target="_blank" rel="noopener">Entwicklertool</a></div>\n<header class="nav"'%L['studio'],1)
    s=s.replace('<li><a href="#leistung">','<li><a href="#demo">Demo</a></li><li><a href="#leistung">',1)
    s=s.replace('<a class="btn ghost" href="#leistung">Leistungen ansehen</a>','<a class="btn ghost" href="#demo">Demo ausprobieren</a>',1)
    s=s.replace('  <section id="leistung"',DEMO+'  <section id="leistung"',1)
    stage=STAGE.replace('/*APPS*/',json.dumps(apps,ensure_ascii=False).replace('</','<\\/')).replace('/*LINKS*/',json.dumps({'hammer':L['hammer'],'bautest':L['bautest']}))
    s=s.replace('</footer>','</footer>\n'+stage,1)
    return s
assert 'id="demo"' in build('pages')
(root/'kunden/website/richtwerk-website.html').write_text(build('artifact'),encoding='utf-8')
(root/'kunden/website/richtwerk-website-pages.html').write_text(build('pages'),encoding='utf-8')
print('Website gebaut')
