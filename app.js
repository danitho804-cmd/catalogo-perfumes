/* ============================================================
   CONFIGURACIÓN: es lo ÚNICO que debes pegar una vez.
   Los obtienes en Supabase > Project Settings > API.
   Usa la clave "anon" o "publishable" (NUNCA la "service_role"/"secret").
   ============================================================ */
var SUPABASE_URL = "https://ngzvamxsoimvrnlnvhzs.supabase.co";
var SUPABASE_KEY = "sb_publishable_BQhf6nLS3jultJo-MWpSLQ_61TD5b2-";
var BUCKET = "fotos";

var SB = SUPABASE_URL.replace(/\/+$/, "");
var CONFIGURED = SUPABASE_URL.indexOf("TU-PROYECTO") < 0 && SUPABASE_KEY.indexOf("TU-CLAVE") < 0;

var S = {store:"",wa:"",cur:"$",hSub:"",hTit:"",secT:"",secS:"",foot:"",acc:"#ff1f3d",spd:3,greet:"Hola",cats:[],prods:[]},
    cart = {}, cur = 0, timer, dirty = false, ADMIN = false, adm = {tab:"prods", edit:null}, famSel = null, armed = null, sess = null;
var $ = function(i){return document.getElementById(i)};
var esc = function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
var money = function(n){return S.cur+Number(n||0).toLocaleString("es-MX")};
var byId = function(a,id){return a.filter(function(x){return x.id==id})[0]};
function toast(t){var e=$("toast");e.textContent=t;e.classList.add("on");clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove("on")},2600)}
function bottle(c,u){c=c||["#ff1f3d","#7a0014"];return '<svg viewBox="0 0 120 190" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g'+u+'" x1="0" x2="1"><stop offset="0" stop-color="'+c[1]+'"/><stop offset=".45" stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[1]+'"/></linearGradient><linearGradient id="k'+u+'" x1="0" x2="1"><stop offset="0" stop-color="#6b5b2a"/><stop offset=".5" stop-color="#f3dc8a"/><stop offset="1" stop-color="#6b5b2a"/></linearGradient></defs><rect x="40" y="6" width="40" height="34" rx="4" fill="url(#k'+u+')"/><rect x="50" y="40" width="20" height="14" fill="#ddd" opacity=".6"/><rect x="14" y="54" width="92" height="128" rx="14" fill="url(#g'+u+')" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/><rect x="30" y="92" width="60" height="40" rx="3" fill="rgba(0,0,0,.5)" stroke="#f3dc8a" stroke-width=".8"/><path d="M24 66 Q22 120 28 170" stroke="rgba(255,255,255,.55)" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'}
function pic(p,u,lz){return p.img?'<img src="'+esc(p.img)+'" alt="'+esc(p.n)+'" decoding="async"'+(lz?' loading="lazy"':'')+'>':bottle(p.c,u)}

/* ===== Supabase: sesión del administrador (solo con fetch, sin librerías) ===== */
function saveSess(j){
  sess = {a:j.access_token, r:j.refresh_token, e:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600)};
  try{localStorage.setItem("cat_sess",JSON.stringify(sess))}catch(e){}
}
function clearSess(){sess=null;try{localStorage.removeItem("cat_sess")}catch(e){}}
/* Supabase pide un correo para iniciar sesión. Si escribes solo "admin",
   se usa internamente admin@catalogo.com (no se envía ningún correo). */
var USER_DOMAIN = "@catalogo.com";
function toEmail(u){u=String(u||"").trim().toLowerCase();return u.indexOf("@")<0?u+USER_DOMAIN:u}
async function login(user,pass){
  var r=await fetch(SB+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:toEmail(user),password:pass})});
  var j={};try{j=await r.json()}catch(e){}
  if(!r.ok||!j.access_token)throw new Error("Usuario o contraseña incorrectos");
  saveSess(j);
}
async function getToken(){
  if(!CONFIGURED)return null;
  if(!sess){try{sess=JSON.parse(localStorage.getItem("cat_sess"))}catch(e){}}
  if(!sess||!sess.a)return null;
  if(sess.e-60>Date.now()/1000)return sess.a;
  try{
    var r=await fetch(SB+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:sess.r})});
    var j=await r.json();
    if(r.ok&&j.access_token){saveSess(j);return sess.a}
    clearSess();return null;
  }catch(e){return null}
}
function authH(tok,extra){var h={"apikey":SUPABASE_KEY,"Authorization":"Bearer "+tok};for(var k in extra)h[k]=extra[k];return h}
async function errMsg(r){try{var j=await r.json();return j.message||j.error_description||j.error||("Error "+r.status)}catch(e){return "Error "+r.status}}

/* ===== Supabase: leer y guardar el catálogo ===== */
async function loadRemote(){
  var r=await fetch(SB+"/rest/v1/catalogo?id=eq.1&select=data",{headers:{"apikey":SUPABASE_KEY},cache:"no-store"});
  if(!r.ok)throw new Error(await errMsg(r));
  var rows=await r.json();
  return rows&&rows[0]&&rows[0].data?rows[0].data:null;
}
async function saveRemote(tok){
  delete S.pin;
  var h=authH(tok,{"Content-Type":"application/json","Prefer":"return=representation"});
  var r=await fetch(SB+"/rest/v1/catalogo?id=eq.1",{method:"PATCH",headers:h,body:JSON.stringify({data:S,updated_at:new Date().toISOString()})});
  if(!r.ok)throw new Error(await errMsg(r));
  var rows=await r.json();
  if(rows&&rows.length)return;
  /* la fila aún no existe: se crea la primera vez */
  r=await fetch(SB+"/rest/v1/catalogo",{method:"POST",headers:h,body:JSON.stringify({id:1,data:S})});
  if(!r.ok)throw new Error(await errMsg(r));
}
function cacheSet(){try{localStorage.setItem("cat_cache",JSON.stringify(S))}catch(e){}}
function applyData(d){
  if(!d||!d.cats||!d.prods)return false;
  delete d.pin;S=d;
  if(!byId(S.cats,famSel))famSel=S.cats[0]&&S.cats[0].id;
  return true;
}
async function boot(){
  var shown=false,cached=null;
  try{cached=JSON.parse(localStorage.getItem("cat_cache"))}catch(e){}
  if(applyData(cached)){all();shown=true}
  else{try{var r=await fetch("data.json");if(applyData(await r.json())){all();shown=true}}catch(e){}}
  if(CONFIGURED){
    try{
      var d=await loadRemote();
      if(d&&!dirty&&JSON.stringify(d)!==JSON.stringify(S)){applyData(d);all();shown=true}
      if(d)cacheSet();
    }catch(e){}
  }
  if(!shown)all();
}

/* ===== Vitrina ===== */
function head(){$("logo").textContent=S.store||"✦";$("hSub").textContent=S.hSub||"";$("hTit").textContent=S.hTit||"";$("secT").textContent=S.secT||"";$("secS").textContent=S.secS||"";$("footT").textContent=S.foot||"";var a=S.acc||"#ff1f3d",n=parseInt(a.slice(1),16),f=function(v){return Math.round(v*.6)},st=document.documentElement.style;st.setProperty("--red",a);st.setProperty("--red2","rgb("+f(n>>16)+","+f((n>>8)&255)+","+f(n&255)+")");}
var slides=[],list=[];
function buildCarousel(){
  list=S.prods.filter(function(p){return p.car&&!p.off});
  var st=$("stage");st.innerHTML="";$("dots").innerHTML="";slides=[];
  $("wrap").style.display=list.length?"":"none";
  list.forEach(function(p,i){
    var s=document.createElement("div");s.className="sl";
    s.innerHTML=pic(p,"s"+i)+"<p>"+esc(p.n.toUpperCase())+"</p>";
    s.onclick=function(){if(drag){drag=false;return}if(i==cur)openDet(p.id);else go(i)};st.appendChild(s);slides.push(s);
    var d=document.createElement("i");d.onclick=function(){go(i)};$("dots").appendChild(d);
  });
  if(cur>=list.length)cur=0;layout();auto();
}
function layout(){
  var n=list.length,W=innerWidth,gap=W<600?Math.round(W*.31):Math.min(Math.round(W*.26),250);
  slides.forEach(function(s,i){
    var o=((i-cur)%n+n)%n;if(o>n/2)o-=n;var a=Math.abs(o),sg=o<0?-1:1;
    var xx=gap*(1+.8*(a-1));if(a>0&&xx>W/2-30){s.style.visibility="hidden";s.style.opacity=0;s.style.pointerEvents="none";s.style.transform="translateX("+sg*xx+"px) translateZ(-250px) scale(.5)"}
    else{s.style.visibility="visible";s.style.pointerEvents="auto";s.style.opacity=a==0?1:Math.max(.6,1-.12*a);s.style.filter=a==0?"none":"brightness("+Math.max(.45,.9-.15*a)+")";
      s.style.transform=a==0?"translateZ(130px) scale(1.06)":"translateX("+sg*xx+"px) translateZ("+(-a*70)+"px) rotateY("+(-sg*Math.min(12+a*6,36))+"deg) scale("+Math.max(.6,1-a*.08)+")"}
    s.style.zIndex=10-a;s.classList.toggle("on",a==0);
  });
  [].forEach.call($("dots").children,function(d,i){d.classList.toggle("on",i==cur)});
}
function go(i){if(!list.length)return;cur=(i+list.length)%list.length;layout();auto()}
function auto(){clearInterval(timer);timer=setInterval(function(){if(list.length>1){cur=(cur+1)%list.length;layout()}},(S.spd||3)*1000)}
$("prev").onclick=function(){go(cur-1)};$("next").onclick=function(){go(cur+1)};
var sx=null,drag=false;$("stage").addEventListener("pointerdown",function(e){sx=e.clientX;drag=false});
$("stage").addEventListener("pointerup",function(e){if(sx===null)return;var dx=e.clientX-sx;if(Math.abs(dx)>40){drag=true;go(cur+(dx<0?1:-1));setTimeout(function(){drag=false},80)}sx=null});
addEventListener("resize",layout);

function tabs(){
  if(!byId(S.cats,famSel))famSel=S.cats[0]&&S.cats[0].id;
  $("tabs").innerHTML=S.cats.map(function(k){return '<button class="btn tab'+(k.id==famSel?" on":"")+'" data-k="'+esc(k.id)+'">'+esc(k.n)+'</button>'}).join("");
  [].forEach.call($("tabs").children,function(b){b.onclick=function(){famSel=b.dataset.k;tabs();grid()}});
}
function grid(){
  var c=byId(S.cats,famSel);
  $("grid").innerHTML=S.prods.filter(function(p){return p.cat==famSel&&!p.off}).map(function(p,i){
    return '<div class="card glass" data-d="'+esc(p.id)+'" style="animation-delay:'+i*.08+'s">'+(p.tag?'<span class="badge">'+esc(p.tag)+'</span>':'')
    +'<div class="ph">'+pic(p,"c"+i,1)+'</div><h3>'+esc(String(p.n).toUpperCase())+'</h3><div class="fam">'+esc(c?c.n:"")+' · '+esc(p.ml)+' ml</div>'
    +'<ul>'+(p.notas?'<li>'+esc(p.notas)+'</li>':'')+(p.e||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+(p.d?'<li>'+esc(p.d)+'</li>':'')+'</ul>'
    +'<div class="price">'+money(p.p)+'</div><button class="btn red add'+(p.out?" out":"")+'" data-id="'+esc(p.id)+'">'+(p.out?"AGOTADO":"AGREGAR A TU CARRITO")+'</button></div>';
  }).join("")||'<p class="empty" style="grid-column:1/-1">Próximamente nuevas fragancias.</p>';
  [].forEach.call(document.querySelectorAll(".add"),function(b){b.onclick=function(){cart[b.dataset.id]=(cart[b.dataset.id]||0)+1;renderCart();var c=$("count");c.classList.remove("bump");void c.offsetWidth;c.classList.add("bump");toast("Añadido al carrito ✓")}});[].forEach.call(document.querySelectorAll(".card"),function(cd){cd.onmousemove=function(e){var r=cd.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;cd.style.transform="perspective(700px) rotateX("+(-py*8)+"deg) rotateY("+(px*10)+"deg) translateY(-8px)"};cd.onmouseleave=function(){cd.style.transform=""};cd.onclick=function(e){if(e.target.closest(".add"))return;openDet(cd.dataset.d)}});
}
function chg(id,d){cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];renderCart()}
function renderCart(){
  var t=0,n=0,h="";
  Object.keys(cart).forEach(function(id){var p=byId(S.prods,id);if(!p){delete cart[id];return}var q=cart[id],c=byId(S.cats,p.cat);t+=p.p*q;n+=q;
    h+='<div class="it"><div>'+esc(p.n)+'<small>'+esc(c?c.n:"")+' · '+esc(p.ml)+' ml · '+money(p.p)+'</small></div><div class="qty"><button data-i="'+esc(id)+'" data-d="-1">−</button>'+q+'<button data-i="'+esc(id)+'" data-d="1">+</button></div></div>'});
  $("items").innerHTML=h||'<p class="empty">Tu carrito está vacío.<br>Puedes escribirnos igual y te asesoramos.</p>';
  [].forEach.call($("items").querySelectorAll("button"),function(b){b.onclick=function(){chg(b.dataset.i,+b.dataset.d)}});
  $("total").textContent=money(t);$("count").textContent=n;
}
function cartOpen(v){$("cart").classList.toggle("on",v);$("ov").classList.toggle("on",v)}
$("openCart").onclick=function(){cartOpen(true)};$("closeCart").onclick=$("ov").onclick=function(){cartOpen(false)};
$("clear").onclick=function(){cart={};renderCart()};
$("send").onclick=function(){
  var ids=Object.keys(cart),t=0,m=(S.greet||"Hola")+(S.store?" "+S.store:"")+" ✨, me gustaría información y hacer este pedido:\n\n";
  if(ids.length){ids.forEach(function(id){var p=byId(S.prods,id),c=byId(S.cats,p.cat);t+=p.p*cart[id];m+="• "+cart[id]+" x "+p.n+" ("+(c?c.n:"")+", "+p.ml+" ml) – "+money(p.p*cart[id])+"\n"});m+="\nTotal: "+money(t)+"\n"}
  else m+="Aún no he elegido perfumes, quisiera asesoría.\n";
  var note=$("note").value.trim();if(note)m+="\nLo que necesito / quiero ver: "+note+"\n";
  window.open("https://wa.me/"+String(S.wa).replace(/\D/g,"")+"?text="+encodeURIComponent(m),"_blank");
};
function all(){head();buildCarousel();tabs();grid();renderCart();if(ADMIN)admRender()}

/* ===== Detalle ===== */
function closeDet(){$("det").classList.remove("on")}
function openDet(id){
  var p=byId(S.prods,id);if(!p)return;var c=byId(S.cats,p.cat),ch=(p.e||[]).concat(p.d?[p.d]:[]);
  $("det").innerHTML='<div class="dp glass"><button class="x" id="dX" aria-label="Cerrar">×</button><div class="pic">'+pic(p,"dt")+'</div><div class="inf"><div class="fam">'+esc(c?c.n:"")+' · '+esc(p.ml)+' ml</div><h3 style="font-size:1.5rem;font-weight:500;letter-spacing:.18em;margin:8px 0">'+esc(String(p.n).toUpperCase())+'</h3>'+(p.tag?'<div><span class="badge" style="position:static;display:inline-block">'+esc(p.tag)+'</span></div>':'')
  +(p.notas?'<p style="margin:16px 0 4px;color:var(--gold);letter-spacing:.14em;text-transform:uppercase;font-size:.68rem">Notas olfativas</p><p style="margin:0;font-weight:300">'+esc(p.notas)+'</p>':'')
  +'<ul class="chips">'+ch.map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ul><div class="price">'+money(p.p)+'</div>'
  +'<button class="btn red'+(p.out?" out":"")+'" id="dAdd">'+(p.out?"AGOTADO":"AGREGAR A TU CARRITO")+'</button><button class="btn" id="dWa">💬 Consultar por WhatsApp</button></div></div>';
  $("det").classList.add("on");
  $("dX").onclick=closeDet;$("det").onclick=function(e){if(e.target===this)closeDet()};
  $("dAdd").onclick=function(){cart[p.id]=(cart[p.id]||0)+1;renderCart();var k=$("count");k.classList.remove("bump");void k.offsetWidth;k.classList.add("bump");toast("Añadido al carrito ✓");closeDet()};
  $("dWa").onclick=function(){window.open("https://wa.me/"+String(S.wa).replace(/\D/g,"")+"?text="+encodeURIComponent((S.greet||"Hola")+", me interesa el perfume "+p.n+" ("+(c?c.n:"")+", "+p.ml+" ml). ¿Me das más información?"),"_blank")};
}
document.addEventListener("keydown",function(e){if(e.key=="Escape")closeDet()});

/* ===== Fotos: reducir y subir a Supabase Storage ===== */
function loadImg(f){return new Promise(function(ok,no){var u=URL.createObjectURL(f),i=new Image();i.onload=function(){URL.revokeObjectURL(u);ok(i)};i.onerror=function(){URL.revokeObjectURL(u);no(new Error("No se pudo leer la imagen"))};i.src=u})}
async function prepPhoto(f){
  var im=await loadImg(f),max=900,w=im.naturalWidth,h=im.naturalHeight,k=Math.min(1,max/Math.max(w,h));
  var c=document.createElement("canvas");c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
  c.getContext("2d").drawImage(im,0,0,c.width,c.height);
  return new Promise(function(ok,no){c.toBlob(function(b){b?ok(b):no(new Error("No se pudo preparar la foto"))},"image/webp",.88)});
}
function slug(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30)||"foto"}
async function uploadPhoto(f,nombre){
  var tok=await getToken();if(!tok)throw new Error("Tu sesión caducó. Entra de nuevo.");
  var b=await prepPhoto(f),ext=b.type=="image/webp"?"webp":"png";
  var name="p-"+Date.now().toString(36)+"-"+slug(nombre)+"."+ext;
  var r=await fetch(SB+"/storage/v1/object/"+BUCKET+"/"+name,{method:"POST",headers:authH(tok,{"Content-Type":b.type,"cache-control":"max-age=31536000"}),body:b});
  if(!r.ok)throw new Error(await errMsg(r));
  return SB+"/storage/v1/object/public/"+BUCKET+"/"+name;
}

/* ===== Administración ===== */
function mark(){dirty=true}
function admRender(){
  var h='<div class="panel glass"><div class="mh"><h3>PANEL DE ADMINISTRACIÓN</h3><button class="x" id="aClose">×</button></div><div class="bar">'
  +['prods:Perfumes','cats:Categorías','set:Ajustes'].map(function(t){var a=t.split(":");return '<button class="btn sm'+(adm.tab==a[0]&&!adm.edit?" red":"")+'" data-t="'+a[0]+'">'+a[1]+'</button>'}).join("")
  +'<span style="flex:1"></span>'+(dirty?'<span class="dirty">● Cambios sin guardar</span>':'')+'<button class="btn sm red" id="aPub">Guardar cambios</button><button class="btn sm" id="aOut">Cerrar sesión</button></div>';
  if(adm.edit)h+=formHTML();else if(adm.tab=="prods")h+=prodsHTML();else if(adm.tab=="cats")h+=catsHTML();else h+=setHTML();
  $("adm").innerHTML=h+'</div>';bind();
}
function prodsHTML(){
  var h='<button class="btn sm red" style="margin-bottom:12px" id="aNew">+ Nuevo perfume</button>';
  S.cats.forEach(function(c){
    h+='<h3 style="font-size:.85rem;margin:14px 0 8px;color:var(--red)">'+esc(c.n.toUpperCase())+'</h3>';
    S.prods.filter(function(p){return p.cat==c.id}).forEach(function(p,i){
      h+='<div class="row"><div class="th">'+pic(p,"a"+p.id)+'</div><div class="nm">'+esc(p.n)+'<small>'+money(p.p)+' · '+esc(p.ml)+' ml'+(p.car?' · en carrusel':'')+(p.out?' · agotado':'')+(p.off?' · oculto':'')+'</small></div><div class="ac"><button class="btn sm" data-up="'+p.id+'">↑</button><button class="btn sm" data-dn="'+p.id+'">↓</button><button class="btn sm" data-ed="'+p.id+'">Editar</button><button class="btn sm" data-dup="'+p.id+'">Duplicar</button><button class="btn sm" data-del="'+p.id+'">Eliminar</button></div></div>'});
  });
  return h||'<p class="note">Aún no hay perfumes.</p>';
}
function formHTML(){
  var p=adm.edit,opts=S.cats.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id==p.cat?" selected":"")+'>'+esc(c.n)+'</option>'}).join("");
  return '<div class="fg"><label>Nombre<input data-f="n" value="'+esc(p.n)+'"></label><label>Categoría<select data-f="cat">'+opts+'</select></label>'
  +'<label>Precio<input data-f="p" type="number" min="0" value="'+esc(p.p)+'"></label><label>Tamaño (ml)<input data-f="ml" type="number" min="0" value="'+esc(p.ml)+'"></label>'
  +'<label>Etiqueta (Nuevo, Premium...)<input data-f="tag" value="'+esc(p.tag)+'"></label><label>Ocasión / temporada<input data-f="d" value="'+esc(p.d)+'"></label>'
  +'<label class="w2">Notas olfativas<input data-f="notas" value="'+esc(p.notas)+'"></label>'
  +'<label class="w2">Características (una por línea)<textarea data-f="e" rows="4">'+esc((p.e||[]).join("\n"))+'</textarea></label>'
  +'<label class="w2"><span><input type="checkbox" data-f="car" style="width:auto;margin-right:8px"'+(p.car?" checked":"")+'>Mostrar en el carrusel principal</span></label><label><span><input type="checkbox" data-f="out" style="width:auto;margin-right:8px"'+(p.out?" checked":"")+'>Marcar como agotado</span></label><label><span><input type="checkbox" data-f="off" style="width:auto;margin-right:8px"'+(p.off?" checked":"")+'>Ocultar del catálogo</span></label>'
  +'<div class="w2"><label>Foto del perfume (PNG o WebP sin fondo)</label><div class="pv" id="pv">'+pic(p,"pv")+'</div><div class="bar" style="margin:10px 0 0"><label class="btn sm" style="cursor:pointer">Subir foto<input type="file" id="aFile" accept="image/png,image/webp,image/*" style="display:none"></label><button class="btn sm" id="aNoImg">Quitar foto</button></div><label style="margin-top:10px">O pega la dirección de una foto ya subida (ej. images/oud.png)<input id="aImgPath" value="'+esc(p.img&&p.img.indexOf("data:")!=0?p.img:"")+'"></label><p class="note">La foto se reduce y se guarda en tu carpeta de fotos de Supabase. Si no hay foto, se muestra un frasco ilustrado.</p></div></div>'
  +'<div class="bar" style="margin-top:16px"><button class="btn red" id="aSave">Guardar perfume</button><button class="btn" id="aCancel">Cancelar</button></div>';
}
function catsHTML(){
  return S.cats.map(function(c){return '<div class="row"><div class="nm"><input data-cn="'+esc(c.id)+'" value="'+esc(c.n)+'" placeholder="Nombre"><input data-cd="'+esc(c.id)+'" value="'+esc(c.d)+'" placeholder="Descripción" style="margin-top:6px"></div><div class="ac"><button class="btn sm" data-cu="'+c.id+'">↑</button><button class="btn sm" data-cdn="'+c.id+'">↓</button><button class="btn sm" data-cdel="'+c.id+'">Eliminar</button></div></div>'}).join("")
  +'<button class="btn sm red" id="aNewCat">+ Nueva categoría</button><p class="note">Una categoría solo se puede eliminar si no tiene perfumes.</p>';
}
function setHTML(){
  return '<div class="fg"><label>Nombre de la tienda (vacío = sin nombre)<input data-s="store" value="'+esc(S.store)+'"></label><label>WhatsApp (código de país + número)<input data-s="wa" value="'+esc(S.wa)+'"></label>'
  +'<label>Símbolo de moneda<input data-s="cur" value="'+esc(S.cur)+'"></label><label>Saludo de WhatsApp<input data-s="greet" value="'+esc(S.greet)+'"></label><label>Texto pequeño del inicio<input data-s="hSub" value="'+esc(S.hSub)+'"></label><label class="w2">Título principal<input data-s="hTit" value="'+esc(S.hTit)+'"></label><label>Título del catálogo<input data-s="secT" value="'+esc(S.secT)+'"></label><label>Subtítulo del catálogo<input data-s="secS" value="'+esc(S.secS)+'"></label><label class="w2">Texto del pie de página<input data-s="foot" value="'+esc(S.foot)+'"></label><label>Segundos por perfume en el carrusel<input data-s="spd" type="number" min="1" max="10" value="'+esc(S.spd)+'"></label><label>Color de acento (botones y brillos)<input data-s="acc" type="color" value="'+esc(S.acc||"#ff1f3d")+'" style="height:42px;padding:3px"></label></div>'
  +'<div class="bar" style="margin-top:18px"><button class="btn" id="aExp">⬇ Exportar respaldo (.json)</button><label class="btn" style="cursor:pointer">⬆ Importar respaldo<input type="file" id="aImp" accept=".json,application/json" style="display:none"></label></div><p class="note">El respaldo incluye todos tus perfumes, categorías y ajustes. Las fotos se guardan como enlaces a tu carpeta de fotos. Tu contraseña de administrador se cambia desde Supabase (Authentication).</p>';
}
function mv(a,id,d){var i=a.findIndex(function(x){return x.id==id}),j=i+d;if(j<0||j>=a.length)return;var t=a[i];a[i]=a[j];a[j]=t}
function bind(){
  var q=function(s,f){[].forEach.call($("adm").querySelectorAll(s),f)};
  $("aClose").onclick=function(){$("adm").classList.remove("on")};
  $("aOut").onclick=function(){if(dirty&&!confirm("Tienes cambios sin guardar. ¿Cerrar sesión de todos modos?"))return;clearSess();ADMIN=false;$("admOpen").classList.remove("on");$("adm").classList.remove("on");toast("Sesión cerrada")};
  q("[data-t]",function(b){b.onclick=function(){adm.tab=b.dataset.t;adm.edit=null;admRender()}});
  $("aPub").onclick=publish;
  var nb=$("aNew");if(nb)nb.onclick=function(){adm.edit={id:"p"+Date.now(),cat:S.cats[0]?S.cats[0].id:"",n:"",p:0,ml:100,notas:"",e:[],d:"",tag:"",img:"",car:true,c:["#ff1f3d","#7a0014"],isNew:true};admRender()};
  q("[data-ed]",function(b){b.onclick=function(){adm.edit=JSON.parse(JSON.stringify(byId(S.prods,b.dataset.ed)));admRender()}});
  q("[data-dup]",function(b){b.onclick=function(){var o=JSON.parse(JSON.stringify(byId(S.prods,b.dataset.dup)));o.id="p"+Date.now();o.n+=" (copia)";var i=S.prods.findIndex(function(x){return x.id==b.dataset.dup});S.prods.splice(i+1,0,o);mark();all();toast("Duplicado ✓")}});
  q("[data-up]",function(b){b.onclick=function(){mv(S.prods,b.dataset.up,-1);mark();all()}});
  q("[data-dn]",function(b){b.onclick=function(){mv(S.prods,b.dataset.dn,1);mark();all()}});
  q("[data-del]",function(b){b.onclick=function(){if(armed!=b.dataset.del){armed=b.dataset.del;b.textContent="¿Seguro?";return}S.prods=S.prods.filter(function(p){return p.id!=armed});armed=null;mark();all()}});
  if(adm.edit){
    var p=adm.edit;
    q("[data-f]",function(el){el.oninput=el.onchange=function(){var k=el.dataset.f;p[k]=el.type=="checkbox"?el.checked:k=="e"?el.value.split("\n").map(function(s){return s.trim()}).filter(Boolean):(k=="p"||k=="ml")?Number(el.value):el.value}});
    $("aFile").onchange=async function(){
      var f=this.files[0];if(!f)return;toast("Subiendo foto…");
      try{
        if(!CONFIGURED)throw new Error("Falta conectar Supabase en app.js");
        p.img=await uploadPhoto(f,p.n);
        $("pv").innerHTML=pic(p,"pv");
        toast(f.type=="image/jpeg"?"Foto lista ✓ (aviso: el JPG no tiene fondo transparente)":"Foto lista ✓");
      }catch(e){toast("No se pudo subir la foto: "+(e.message||""))}
    };
    $("aNoImg").onclick=function(){p.img="";$("aImgPath").value="";$("pv").innerHTML=pic(p,"pv")};$("aImgPath").oninput=function(){p.img=this.value.trim();$("pv").innerHTML=pic(p,"pv")};
    $("aCancel").onclick=function(){adm.edit=null;admRender()};
    $("aSave").onclick=function(){
      if(!String(p.n).trim()){toast("Escribe el nombre del perfume");return}
      delete p.isNew;var i=S.prods.findIndex(function(x){return x.id==p.id});
      if(i<0)S.prods.push(p);else S.prods[i]=p;
      adm.edit=null;mark();all();toast("Perfume listo ✓ · toca \"Guardar cambios\" para publicarlo");
    };
  }
  q("[data-cn]",function(el){el.oninput=function(){byId(S.cats,el.dataset.cn).n=el.value;mark()};el.onchange=all});
  q("[data-cd]",function(el){el.oninput=function(){byId(S.cats,el.dataset.cd).d=el.value;mark()}});
  q("[data-cu]",function(b){b.onclick=function(){mv(S.cats,b.dataset.cu,-1);mark();all()}});
  q("[data-cdn]",function(b){b.onclick=function(){mv(S.cats,b.dataset.cdn,1);mark();all()}});
  q("[data-cdel]",function(b){b.onclick=function(){if(S.prods.some(function(p){return p.cat==b.dataset.cdel})){toast("Mueve o elimina primero sus perfumes");return}S.cats=S.cats.filter(function(c){return c.id!=b.dataset.cdel});mark();all()}});
  var nc=$("aNewCat");if(nc)nc.onclick=function(){S.cats.push({id:"c"+Date.now(),n:"Nueva categoría",d:""});mark();all()};
  q("[data-s]",function(el){el.oninput=function(){S[el.dataset.s]=el.value;mark();head();renderCart();if(el.dataset.s=="spd")auto()}});
  var ex=$("aExp");if(ex)ex.onclick=function(){var b=new Blob([JSON.stringify(S,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="catalogo-respaldo.json";document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},600)};
  var im=$("aImp");if(im)im.onchange=function(){var f=this.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var d=JSON.parse(r.result);if(!applyData(d))throw 0;mark();all();toast("Respaldo importado ✓ · toca \"Guardar cambios\" para publicarlo")}catch(e){toast("Archivo no válido")}};r.readAsText(f)};
}
async function publish(){
  var tok=await getToken();
  if(!tok){ADMIN=false;$("admOpen").classList.remove("on");toast("Tu sesión caducó. Entra de nuevo.");pinGate();return}
  toast("Guardando…");
  try{
    await saveRemote(tok);
    dirty=false;cacheSet();admRender();toast("Guardado ✓ Ya lo ve todo el mundo");
  }catch(e){toast("No se pudo guardar: "+(e.message||"revisa tu conexión"))}
}
function openAdm(){$("adm").classList.add("on");admRender()}
function pinGate(){
 if(!CONFIGURED){toast("Falta conectar Supabase: pega tu URL y clave en app.js");return}
 if(ADMIN){openAdm();return}
 $("adm").classList.add("on");
 $("adm").innerHTML='<div class="panel glass" style="max-width:380px;text-align:center"><div class="mh"><h3>ACCESO</h3><button class="x" id="pClose">×</button></div><p class="note">Entra con tu usuario y contraseña de administrador</p><input id="pMail" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="Usuario" style="margin:12px 0 0;text-align:center"><input id="pIn" type="password" autocomplete="current-password" placeholder="Contraseña" style="margin:10px 0 12px;text-align:center"><button class="btn red full" id="pOk">Entrar</button></div>';
 $("pClose").onclick=function(){$("adm").classList.remove("on")};
 async function go(){
   var b=$("pOk");b.disabled=true;
   try{await login($("pMail").value.trim(),$("pIn").value);ADMIN=true;$("admOpen").classList.add("on");openAdm()}
   catch(e){toast(e.message||"No se pudo entrar");b.disabled=false;$("pIn").value=""}
 }
 $("pOk").onclick=go;$("pIn").onkeydown=function(e){if(e.key=="Enter")go()};$("pMail").focus();
}
$("admOpen").onclick=pinGate;$("admFoot").onclick=pinGate;

/* ===== Arranque ===== */
renderCart();
boot();
(async function(){var t=await getToken();if(t){ADMIN=true;$("admOpen").classList.add("on")}})();

/* Partículas de fondo */
(function(){var cv=$("fx"),x=cv.getContext("2d"),W,H,ps=[];if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;function rs(){W=cv.width=innerWidth;H=cv.height=innerHeight}function mk(r){return{x:Math.random()*W,y:r?Math.random()*H:H+10,r:Math.random()*2.2+.6,v:Math.random()*.7+.25,a:Math.random()*.6+.2,w:Math.random()*6.28}}rs();addEventListener("resize",rs);for(var i=0;i<(innerWidth<700?16:40);i++)ps.push(mk(true));(function f(){x.clearRect(0,0,W,H);ps.forEach(function(p,i){p.y-=p.v;p.w+=.02;p.x+=Math.sin(p.w)*.4;if(p.y<-10)ps[i]=mk(false);x.beginPath();x.arc(p.x,p.y,p.r,0,6.3);x.fillStyle="rgba(255,"+(40+p.r*20|0)+",70,"+p.a+")";x.fill()});requestAnimationFrame(f)})()})();
