"use strict";
/* Bake: baker's math for real kitchens. Formulas with baker's percentages and hydration, scaling by
   batch, pieces, flour or the one ingredient you're short of, pan resizing, cups-to-grams, water
   temperature, costing and a bake log. Storage, sign-in, passcode and encrypted sync: pixora-kit.js. */
var B=BakeCore,K=PixoraKit,esc=K.esc;
var S=null,tab="formulas",view=null,how={by:"factor",x:1},editRows=null,editPct=false;
var ROLE={};B.ROLES.forEach(function(r){ROLE[r[0]]=r[1];});var KIND={};B.KINDS.forEach(function(k){KIND[k[0]]=k[1];});
function $(s){return document.querySelector(s);}
function z(n){return String(n).padStart(2,"0");}
function today(){var d=new Date();return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());}
function rid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function num(v){var x=parseFloat(String(v==null?"":v).replace(",","."));return isFinite(x)?x:null;}
function g(v){return v>=1000?(Math.round(v)).toLocaleString(window.PixoraCountry?PixoraCountry.locale():"en-CA")+" g":(v>=100?Math.round(v):Math.round(v*10)/10)+" g";}
function money(v){return window.PixoraCountry?PixoraCountry.money(v,{dec:2}):"$"+(Math.round(v*100)/100).toFixed(2);}
function byId(id){return S.formulas.filter(function(f){return f.id===id;})[0];}
var tt=null;function toast(m){var t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(function(){t.hidden=true;},3500);}
function save(){K.save(S);}
function temp(c){return S.tempUnit==="F"?Math.round((c*9/5+32)*10)/10+"°F":c+"°C";}

/* A handful of starting formulas. All vegetarian; edit or delete any. */
function starters(){
  function f(name,kind,pieces,ing,steps,pan){return {id:rid(),name:name,kind:kind,pieces:pieces,pan:pan||null,steps:steps,notes:"",fav:false,
    ing:ing.map(function(x){var o={id:rid(),name:x[0],g:x[1],role:x[2]||B.guessRole(x[0])};if(o.role==="starter")o.hyd=x[3]==null?100:x[3];return o;})};}
  return [
    f("Sandwich loaf","bread",1,[["Bread flour",500],["Milk",320,"water"],["Butter",30],["Sugar",25],["Salt",10],["Instant yeast",7]],
      "Mix everything to a smooth dough, 8 to 10 minutes. Rise until doubled, about 1 hour. Shape into a log, put in the pan, rise until it crowns the pan. Bake at 190°C for 30 to 35 minutes, to 93°C inside.",{shape:"rect",w:5,l:9,h:3,unit:"in"}),
    f("Pizza dough","pizza",4,[["00 flour",600,"flour"],["Water",390],["Salt",18],["Instant yeast",2],["Olive oil",12,"fat"]],
      "Mix, rest 20 minutes, knead until smooth. Cover and leave 2 hours, then refrigerate 24 to 48 hours. Divide into 4 balls, rest 2 hours at room temperature, stretch and bake as hot as your oven goes."),
    f("Sourdough country loaf","bread",1,[["Bread flour",450],["Whole wheat flour",50],["Water",375],["Starter",100,"starter",100],["Salt",10]],
      "Mix flour and 350 g water, rest 1 hour. Add starter, salt and the last 25 g water. Four sets of stretch and folds 30 minutes apart, then bulk until about 50% bigger. Shape, cold proof overnight. Bake in a covered pot at 250°C for 20 minutes, uncovered at 230°C for 20 to 25."),
    f("Chocolate chip cookies","cookie",24,[["All-purpose flour",280],["Butter",225],["Brown sugar",200],["Sugar",100],["Eggs",100,"egg"],["Vanilla",8,"other"],["Baking soda",5],["Salt",5],["Chocolate chips",340,"other"]],
      "Cream butter and sugars, beat in eggs and vanilla. Mix in flour, soda and salt, then chips. Chill 1 hour. Scoop 50 g balls and bake at 180°C for 10 to 12 minutes."),
    f("Vanilla butter cake","cake",12,[["Cake flour",300,"flour"],["Sugar",300],["Butter",225],["Eggs",200,"egg"],["Milk",240,"water"],["Baking powder",12,"yeast"],["Salt",3],["Vanilla",8,"other"]],
      "Cream butter and sugar until pale. Beat in eggs one at a time and vanilla. Add dry ingredients and milk in turns. Spread in a greased 9×13-inch pan and bake at 175°C for 30 to 35 minutes, until a skewer comes out clean.",{shape:"rect",w:9,l:13,h:2,unit:"in"})
  ];
}

/* ---------- screens ---------- */
function render(){
  var app=$("#app");app.hidden=false;$("#tabs").hidden=false;
  document.querySelectorAll("#tabs button").forEach(function(b){b.setAttribute("aria-current",b.dataset.tab===tab&&!view?"page":"false");});
  app.innerHTML=view?formulaView(byId(view)):tab==="formulas"?listView():tab==="tools"?toolsView():tab==="log"?logView():settingsView();
  if(tab==="tools"&&!view)drawTools();
}
function header(eb,title,right){
  return '<header class="top"><div><p class="eyebrow">'+esc(eb)+'</p><h1>'+esc(title)+'</h1></div><div class="row noprint">'+(right||"")+'<button class="btn q s" data-act="settings">Settings</button></div></header>'+
    '<button class="status noprint" id="st" data-act="settings">'+esc(K.status())+'</button>';
}
function listView(){
  var h=header("Bake","Formulas",'<button class="btn p s" data-act="new">New</button>');
  h+='<div class="row"><button class="btn q s" data-act="convert">Convert a recipe from cups</button></div>';
  if(!S.formulas.length)return h+'<div class="empty"><p>Add your formulas in grams and see baker\'s percentages, hydration, and any size you need.</p><div class="row"><button class="btn p" data-act="new">New formula</button><button class="btn" data-act="seed">Add 5 starting formulas</button></div></div>';
  S.formulas.slice().sort(function(a,b){return (b.fav-a.fav)||a.name.localeCompare(b.name);}).forEach(function(f){
    var a=B.analyze(f),last=S.log.filter(function(l){return l.fid===f.id;}).sort(function(x,y){return y.d.localeCompare(x.d);})[0];
    h+='<button class="fcard" data-act="open" data-id="'+f.id+'"><div class="dayhead"><b>'+(f.fav?"★ ":"")+esc(f.name)+'</b><span class="pill">'+esc(KIND[f.kind])+'</span></div>'+
      '<span class="note">'+g(a.total)+(f.pieces>1?" · "+f.pieces+" pieces":"")+(a.hydration!=null&&(f.kind==="bread"||f.kind==="pizza")?" · "+a.hydration+"% hydration":"")+(last?" · last baked "+esc(last.d):"")+'</span></button>';
  });
  return h;
}
function howLabel(f){
  var a=B.analyze(f);
  if(how.by==="factor")return "× "+how.x;
  if(how.by==="pieces")return how.count+" × "+how.each+" g";
  if(how.by==="total")return g(how.g)+" total";
  if(how.by==="flour")return g(how.g)+" flour";
  if(how.by==="limit"){var i=f.ing.filter(function(x){return x.id===how.id;})[0];return "only "+g(how.g)+" "+(i?i.name.toLowerCase():"");}
  if(how.by==="pan")return "for your pan";
  return "";
}
function formulaView(f){
  if(!f){view=null;return listView();}
  var a=B.analyze(f),k=B.factor(f,how),sc=B.scaled(f,k),showScale=Math.abs(k-1)>1e-6;
  var h='<div class="row noprint"><button class="btn q s" data-act="back">← Formulas</button><button class="btn q s" data-act="edit" data-id="'+f.id+'">Edit</button><button class="btn q s" data-act="logbake" data-id="'+f.id+'">Log a bake</button><button class="btn q s" data-act="print">Print</button></div>';
  h+='<header><p class="eyebrow">'+esc(KIND[f.kind])+(f.pieces>1?" · makes "+f.pieces:"")+'</p><h1>'+esc(f.name)+'</h1></header>';
  h+='<div class="stat"><div><span class="note">Total</span><b>'+g(showScale?a.total*k:a.total)+'</b></div><div><span class="note">Flour</span><b>'+g(showScale?a.flour*k:a.flour)+'</b></div>'+(a.hydration!=null&&(f.kind==="bread"||f.kind==="pizza")?'<div><span class="note">Hydration</span><b>'+a.hydration+'%</b></div>':"")+
    (f.pieces>1?'<div><span class="note">Each</span><b>'+g(a.total*k/(how.by==="pieces"?how.count:f.pieces))+'</b></div>':"")+'</div>';
  h+='<section class="card noprint"><h2>Size</h2><div class="row"><select id="sc-by" style="width:auto">'+
    [["factor","Multiply"],["pieces","Pieces × weight"],["total","Total dough weight"],["flour","Flour weight"],["limit","I only have…"],["pan","A different pan"]].map(function(o){return '<option value="'+o[0]+'"'+(how.by===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select>'+scaleInputs(f)+'</div>'+
    (showScale?'<p class="note">Showing '+esc(howLabel(f))+' (× '+(Math.round(k*1000)/1000)+'). <button class="add" data-act="resetscale">Back to the original</button></p>':"")+'</section>';
  h+='<section class="card"><table class="ftab"><thead><tr><th>Ingredient</th>'+(showScale?'<th>Original</th><th>You need</th>':'<th>Grams</th>')+'<th>%</th></tr></thead><tbody>';
  f.ing.forEach(function(i,ix){
    var s=sc[ix].g,eg=i.role==="egg"?B.eggs(showScale?s:i.g):null;
    h+='<tr><td>'+esc(i.name)+(i.role==="starter"?' <span class="note">('+i.hyd+'%)</span>':"")+'</td>'+(showScale?'<td>'+g(i.g)+'</td><td class="scaled">'+g(s)+'</td>':'<td>'+g(i.g)+'</td>')+'<td>'+(a.pct[ix]!=null?a.pct[ix]+"%":"")+'</td></tr>'+
      (eg?'<tr><td colspan="'+(showScale?4:3)+'" class="note" style="border-top:0;padding-top:0">≈ '+eg.count+' large egg'+(eg.count===1?"":"s")+(Math.abs(eg.exact-eg.count)>0.15?" ("+eg.exact+" exactly; weigh the last one, or beat and pour)":"")+'</td></tr>':"");
  });
  h+='</tbody><tfoot><tr><td>Total</td>'+(showScale?'<td>'+g(a.total)+'</td><td class="scaled">'+g(a.total*k)+'</td>':'<td>'+g(a.total)+'</td>')+'<td></td></tr></tfoot></table>';
  var c=B.cost(f,S.prices,k);
  if(Object.keys(S.prices).length)h+='<p class="note" style="margin-top:8px">Ingredients cost '+money(c.total)+(f.pieces>1?", "+money(c.total/(how.by==="pieces"?how.count:f.pieces))+" each":"")+(c.missing.length?". No price yet for "+esc(c.missing.join(", ")):"")+'.</p>';
  h+='</section>';
  if(f.steps)h+='<section class="card"><h2>Method</h2><p style="white-space:pre-wrap">'+esc(f.steps)+'</p></section>';
  if(f.notes)h+='<section class="card"><h2>Notes</h2><p style="white-space:pre-wrap">'+esc(f.notes)+'</p></section>';
  var logs=S.log.filter(function(l){return l.fid===f.id;}).sort(function(x,y){return y.d.localeCompare(x.d);});
  if(logs.length){h+='<section class="card"><h2>Bakes</h2>';logs.slice(0,8).forEach(function(l){h+='<div class="hold"><span>'+esc(l.d)+(l.k!==1?' · × '+l.k:"")+'<br><span class="note">'+esc(l.note||"")+'</span></span><span class="stars">'+"★".repeat(l.stars)+'</span></div>';});h+='</section>';}
  return h;
}
function scaleInputs(f){
  var i='<input type="text" inputmode="decimal" data-sc="',e='" style="width:96px">';
  if(how.by==="factor")return i+'x" value="'+how.x+e+'<span class="note">× (0.5 halves it)</span>';
  if(how.by==="pieces")return i+'count" value="'+(how.count||f.pieces||1)+e+'<span class="note">pieces of</span>'+i+'each" value="'+(how.each||"")+e+'<span class="note">g</span>';
  if(how.by==="total")return i+'g" value="'+(how.g||"")+e+'<span class="note">g of dough</span>';
  if(how.by==="flour")return i+'g" value="'+(how.g||"")+e+'<span class="note">g of flour</span>';
  if(how.by==="limit")return '<select data-sc="id" style="width:auto">'+f.ing.map(function(x){return '<option value="'+x.id+'"'+(how.id===x.id?" selected":"")+'>'+esc(x.name)+'</option>';}).join("")+'</select>'+i+'g" value="'+(how.g||"")+e+'<span class="note">g</span>';
  if(how.by==="pan"){var p=how.from||f.pan||{shape:"round",d:8,unit:"in"},q=how.to||{shape:p.shape,d:p.d,w:p.w,l:p.l,unit:p.unit};
    return '<div style="display:flex;flex-direction:column;gap:6px;width:100%"><span class="note">Recipe\'s pan</span>'+panInputs("from",p)+'<span class="note">Your pan</span>'+panInputs("to",q)+'</div>';}
  return "";
}
function panInputs(side,p){
  var sel='<select data-pan="'+side+'-shape" style="width:auto">'+[["round","Round"],["square","Square"],["rect","Rectangle"],["bundt","Bundt / tube"]].map(function(o){return '<option value="'+o[0]+'"'+(p.shape===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select>';
  var f=function(k,ph,v){return '<input type="text" inputmode="decimal" data-pan="'+side+'-'+k+'" placeholder="'+ph+'" value="'+(v||"")+'" style="width:72px">';};
  var dims=p.shape==="round"?f("d","across",p.d):p.shape==="square"?f("w","side",p.w):p.shape==="bundt"?f("d","across",p.d)+f("inner","hole",p.inner):f("w","width",p.w)+f("l","length",p.l);
  return '<div class="row">'+sel+dims+f("h","depth (opt.)",p.h)+'<select data-pan="'+side+'-unit" style="width:auto"><option value="in"'+(p.unit!=="cm"?" selected":"")+'>in</option><option value="cm"'+(p.unit==="cm"?" selected":"")+'>cm</option></select></div>';
}
function readPan(side){
  var o={shape:($("[data-pan="+side+"-shape]")||{}).value||"round",unit:($("[data-pan="+side+"-unit]")||{}).value||"in"};
  ["d","w","l","h","inner"].forEach(function(k){var el=$("[data-pan="+side+"-"+k+"]");if(el)o[k]=num(el.value)||0;});
  var cm=o.unit==="cm"?1:2.54;["d","w","l","h","inner"].forEach(function(k){if(o[k])o[k+"cm"]=o[k]*cm;});return o;
}
function inCm(p){return {shape:p.shape,d:p.dcm||0,w:p.wcm||0,l:p.lcm||0,h:p.hcm||0,inner:p.innercm||0};}

function toolsView(){
  var h=header("Bake","Tools");
  h+='<section class="card"><h2>Pan size</h2><p class="note">How much to make for a different pan. Uses the base area, or volume if you give both depths.</p><span class="note">From</span>'+panInputs("tf",{shape:"round",d:8,unit:"in"})+'<span class="note">To</span>'+panInputs("tt",{shape:"rect",w:9,l:13,unit:"in"})+'<p id="t-pan" style="font-weight:600"></p></section>';
  h+='<section class="card"><h2>Cups to grams</h2><p class="note">Paste a recipe, one ingredient per line. Approximate weights for spooned-and-levelled cups; a scale is always better.</p><textarea id="t-conv" placeholder="2 1/4 cups all-purpose flour&#10;1 cup butter&#10;3/4 cup brown sugar&#10;2 large eggs&#10;1 tsp baking soda"></textarea><div id="t-conv-out"></div></section>';
  h+='<section class="card"><h2>Water temperature</h2><p class="note">For a target dough temperature. Friction is how much your mixer warms the dough: about 1°C by hand, 7 to 13°C in a stand mixer.</p><div class="two">'+
    ["target:Dough target:25","room:Room:22","flour:Flour:21","friction:Friction:8"].map(function(x){var p=x.split(":");return '<label class="f">'+p[1]+' °C<input type="text" inputmode="decimal" data-wt="'+p[0]+'" value="'+p[2]+'"></label>';}).join("")+
    '</div><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-wt="starter"> With starter or preferment at <input type="text" inputmode="decimal" data-wt="starterT" value="22" style="width:60px"> °C</label><p id="t-wt" style="font-weight:600"></p></section>';
  h+='<section class="card"><div class="dayhead"><h2>Ingredient prices</h2><button class="add" data-act="price">+ Add</button></div><p class="note">Price per kg, used to cost each formula. Names match ingredient names.</p>';
  var ks=Object.keys(S.prices).sort();if(!ks.length)h+='<p class="note">None yet.</p>';
  ks.forEach(function(k){h+='<div class="hold" data-act="price" data-k="'+esc(k)+'"><span>'+esc(k)+'</span><span class="v">'+money(S.prices[k])+'/kg</span></div>';});
  return h+'</section>';
}
function drawTools(){
  function pan(){var a=readPan("tf"),b=readPan("tt"),k=B.panFactor(inCm(a),inCm(b));$("#t-pan").textContent=k&&isFinite(k)?"Make × "+(Math.round(k*100)/100)+" of the recipe ("+Math.round(B.panArea(inCm(b)))+" cm² vs "+Math.round(B.panArea(inCm(a)))+" cm²).":"";}
  function conv(){var lines=$("#t-conv").value.split(/\n/).filter(function(x){return x.trim();});
    if(!lines.length){$("#t-conv-out").innerHTML="";return;}
    var rows=lines.map(B.toGrams).filter(Boolean),ok=rows.filter(function(r){return r.g!=null;}).length;
    $("#t-conv-out").innerHTML='<table class="ftab"><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.name)+(r.from?' <span class="note">'+esc(r.from)+'</span>':"")+'</td><td'+(r.g==null?' class="note"':' class="scaled"')+'>'+(r.g==null?(r.why==="unknown ingredient"?"weigh it":"—"):g(r.g))+'</td></tr>';}).join("")+'</tbody></table>'+
      (ok?'<div class="row" style="margin-top:8px"><button class="btn p s" data-act="convsave">Save as a formula</button></div>':"");}
  function wt(){var o={};document.querySelectorAll("[data-wt]").forEach(function(el){o[el.dataset.wt]=el.type==="checkbox"?el.checked:num(el.value);});
    var w=B.waterTemp(o);$("#t-wt").textContent="Use water at about "+temp(w)+(w<2?". That's below freezing water: use ice-cold water and some ice, or chill the flour.":w>45?". Above 45°C can hurt yeast: warm the room or the flour instead.":".");}
  document.querySelectorAll("[data-pan^=tf],[data-pan^=tt]").forEach(function(el){el.addEventListener("input",pan);el.addEventListener("change",function(){if(el.dataset.pan.indexOf("shape")>0||el.dataset.pan.indexOf("unit")>0){var side=el.dataset.pan.slice(0,2),p=readPan(side);el.closest("div.row").outerHTML=panInputs(side,p);drawTools();}else pan();});});
  $("#t-conv").addEventListener("input",conv);document.querySelectorAll("[data-wt]").forEach(function(el){el.addEventListener("input",wt);el.addEventListener("change",wt);});
  pan();conv();wt();
}
function logView(){
  var h=header("Bake","Bake log");
  var ls=S.log.slice().sort(function(a,b){return b.d.localeCompare(a.d);});
  if(!ls.length)return h+'<div class="empty"><p>After you bake, log it from the formula: the size you made, how it turned out, and what to change next time.</p></div>';
  ls.forEach(function(l){var f=byId(l.fid);h+='<div class="hold" data-act="editlog" data-id="'+l.id+'"><span><b>'+esc(f?f.name:"Deleted formula")+'</b> · '+esc(l.d)+(l.k!==1?" · × "+l.k:"")+'<br><span class="note">'+esc(l.note||"")+'</span></span><span class="stars">'+"★".repeat(l.stars)+'</span></div>';});
  return h;
}
function settingsView(){
  var h='<button class="btn q s" data-act="tab" data-t="formulas" style="align-self:flex-start">← Back</button><h1>Settings</h1>';
  if(window.PixoraCountry)h+=PixoraCountry.picker("Sets the currency for ingredient prices and how numbers and dates look.");
  h+='<section class="card"><h2>Temperatures</h2><div class="row"><label><input type="radio" name="tu" data-act="tu" value="C"'+(S.tempUnit==="C"?" checked":"")+'> °C</label><label><input type="radio" name="tu" data-act="tu" value="F"'+(S.tempUnit==="F"?" checked":"")+'> °F</label></div></section>';
  h+='<section class="card"><h2>Account</h2>'+(K.local?'<p class="small">On this phone only.</p><div class="row"><button class="btn" data-act="join">Sign in or create a Pixora account</button></div>':
    '<p class="small">Signed in as '+esc(K.email||"")+'. Your formulas are encrypted on this phone before they sync. Nobody else can read them, not even Pixora.</p><div class="row"><button class="btn q" data-act="signout">Sign out</button></div>')+'</section>';
  h+='<section class="card"><h2>Your copy</h2><p class="small muted">Download all your formulas, prices and bake log as a file, and bring it back here or on a new phone. It\'s a plain file, not encrypted.</p><div class="row"><button class="btn" data-act="export">Download a copy</button><label class="btn q" style="cursor:pointer">Restore from a copy<input type="file" id="restore" accept=".json,application/json" hidden></label></div></section>';
  h+='<section class="card"><h2>Ideas or problems?</h2><p class="small muted">Tell Sachin what would make Bake better or what went wrong. Nothing from your formulas is sent.</p><div class="row"><button class="btn" data-act="feedback">Send feedback</button></div></section>';
  h+='<section class="card"><h2>Delete my Bake data</h2><p class="note">Deletes your formulas, prices and bake log from this phone'+(K.local?"":" and your Pixora account")+'. Your Pixora login and other apps aren\'t affected. To delete the Pixora login itself, email pixora3dstudios@gmail.com.</p><div class="row"><button class="btn d" data-act="delall">Delete my Bake data</button></div></section>';
  return h;
}

/* ---------- editing ---------- */
function dlg(html){var d=$("#dlg");d.innerHTML='<div class="form">'+html+'</div>';if(!d.open)d.showModal();return d;}
function closeDlg(){var d=$("#dlg");if(d.open)d.close();d.innerHTML="";}
$("#dlg").addEventListener("cancel",function(e){e.preventDefault();closeDlg();});
function roleSel(v){return B.ROLES.map(function(r){return '<option value="'+r[0]+'"'+(r[0]===v?" selected":"")+'>'+esc(r[1])+'</option>';}).join("");}
function editDialog(f){
  var isNew=!f;f=f||{id:rid(),name:"",kind:"bread",pieces:1,pan:null,steps:"",notes:"",ing:[]};
  editRows=f.ing.length?f.ing.map(function(i){return Object.assign({},i);}):[{id:rid(),name:"Bread flour",g:"",role:"flour"},{id:rid(),name:"Water",g:"",role:"water"},{id:rid(),name:"Salt",g:"",role:"salt"},{id:rid(),name:"Instant yeast",g:"",role:"yeast"}];
  editPct=false;
  dlg('<h2>'+(isNew?"New formula":"Edit formula")+'</h2><label class="f">Name<input type="text" id="e-name" maxlength="80" value="'+esc(f.name)+'"></label>'+
    '<div class="two"><label class="f">Kind<select id="e-kind">'+B.KINDS.map(function(k){return '<option value="'+k[0]+'"'+(k[0]===f.kind?" selected":"")+'>'+k[1]+'</option>';}).join("")+'</select></label><label class="f">Makes (pieces)<input type="text" inputmode="numeric" id="e-pieces" value="'+(f.pieces||1)+'"></label></div>'+
    '<div class="dayhead"><h3>Ingredients</h3><label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="e-pct"> Type baker\'s %</label></div><div id="e-flourw" hidden><label class="f">Total flour, g<input type="text" inputmode="decimal" id="e-fw" value="1000"></label></div>'+
    '<div id="e-rows"></div><div class="row"><button class="add" data-act="addrow">+ Add an ingredient</button></div>'+
    '<details><summary class="small" style="cursor:pointer;font-weight:600">Pan (for resizing)</summary>'+panInputs("e",f.pan||{shape:"round",unit:"in"})+'<label style="display:flex;gap:8px;align-items:center" class="small"><input type="checkbox" id="e-nopan"'+(f.pan?"":" checked")+'> No pan for this one</label></details>'+
    '<label class="f">Method<textarea id="e-steps" maxlength="4000">'+esc(f.steps)+'</textarea></label><label class="f">Notes<textarea id="e-notes" maxlength="2000" style="min-height:70px">'+esc(f.notes)+'</textarea></label>'+
    '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="e-fav"'+(f.fav?" checked":"")+'> Favourite</label>'+
    '<div class="row"><button class="btn p" data-act="saveformula" data-id="'+f.id+'" data-new="'+(isNew?1:0)+'">Save</button><button class="btn q" data-act="close">Cancel</button>'+(isNew?"":'<button class="btn q" data-act="dup" data-id="'+f.id+'">Duplicate</button><button class="btn d" data-act="delformula" data-id="'+f.id+'">Delete</button>')+'</div>');
  drawRows();
  $("#e-pct").addEventListener("change",function(){readRows();editPct=this.checked;$("#e-flourw").hidden=!editPct;
    if(editPct){var fl=editRows.filter(function(r){return r.role==="flour";}).reduce(function(s,r){return s+(num(r.g)||0);},0);if(fl)$("#e-fw").value=fl;}drawRows();});
}
function drawRows(){
  var fw=num(($("#e-fw")||{}).value)||1000;
  $("#e-rows").innerHTML=editRows.map(function(r,i){
    var v=editPct?(num(r.g)!=null&&fw?Math.round(num(r.g)/fw*1000)/10:""):(r.g===""?"":r.g);
    return '<div class="irow" data-row="'+i+'"><input type="text" data-k="name" value="'+esc(r.name)+'" aria-label="Ingredient" maxlength="60"><input type="text" inputmode="decimal" data-k="g" value="'+v+'" aria-label="'+(editPct?"Percent":"Grams")+'" placeholder="'+(editPct?"%":"g")+'">'+
      '<select data-k="role" aria-label="Role">'+roleSel(r.role)+'</select><button class="x" data-act="delrow" data-i="'+i+'" aria-label="Remove">×</button></div>'+
      (r.role==="starter"?'<label class="small" style="display:flex;gap:6px;align-items:center;margin:-2px 0 4px">Starter hydration <input type="text" inputmode="decimal" data-k="hyd" data-i="'+i+'" value="'+(r.hyd==null?100:r.hyd)+'" style="width:64px;min-height:32px"> %</label>':"");
  }).join("");
  $("#e-rows").querySelectorAll("[data-k=role]").forEach(function(s){s.addEventListener("change",function(){readRows();drawRows();});});
  $("#e-rows").querySelectorAll("[data-k=name]").forEach(function(s){s.addEventListener("change",function(){var i=+s.closest("[data-row]").dataset.row;if(!editRows[i].roleSet){editRows[i].role=B.guessRole(s.value);readRows();editRows[i].role=B.guessRole(s.value);drawRows();}});});
}
function readRows(){
  var fw=num(($("#e-fw")||{}).value)||1000;
  document.querySelectorAll("#e-rows [data-row]").forEach(function(row){var i=+row.dataset.row,r=editRows[i];
    r.name=row.querySelector("[data-k=name]").value.trim();var v=num(row.querySelector("[data-k=g]").value);r.g=v==null?"":(editPct?Math.round(v*fw/100*10)/10:v);
    var nr=row.querySelector("[data-k=role]").value;if(nr!==r.role)r.roleSet=true;r.role=nr;});
  document.querySelectorAll("#e-rows [data-k=hyd]").forEach(function(el){editRows[+el.dataset.i].hyd=num(el.value);});
}
function logDialog(fid,l){
  var isNew=!l;l=l||{id:rid(),fid:fid,d:today(),k:Math.round(B.factor(byId(fid)||{ing:[]},how)*1000)/1000,stars:0,note:""};
  dlg('<h2>'+(isNew?"Log a bake":"Edit bake")+'</h2><div class="two"><label class="f">Date<input type="date" id="l-d" value="'+l.d+'"></label><label class="f">Size made (×)<input type="text" inputmode="decimal" id="l-k" value="'+l.k+'"></label></div>'+
    '<fieldset class="f" style="border:0;padding:0;margin:0"><legend>How did it turn out?</legend><div class="row" id="l-stars">'+[1,2,3,4,5].map(function(s){return '<label style="display:flex;gap:4px;align-items:center"><input type="radio" name="st" value="'+s+'"'+(l.stars===s?" checked":"")+'> '+"★".repeat(s)+'</label>';}).join("")+'</div></fieldset>'+
    '<label class="f">Notes<textarea id="l-note" maxlength="1000" placeholder="Proofed 2 h at 24°C, crumb a bit tight, try 72% next time">'+esc(l.note)+'</textarea></label>'+
    '<div class="row"><button class="btn p" data-act="savelog" data-id="'+l.id+'" data-f="'+l.fid+'">Save</button><button class="btn q" data-act="close">Cancel</button>'+(isNew?"":'<button class="btn d" data-act="dellog" data-id="'+l.id+'">Delete</button>')+'</div>');
}

/* ---------- events ---------- */
document.addEventListener("input",function(e){
  var t=e.target;
  if(t.dataset&&t.dataset.sc!=null&&view){how[t.dataset.sc]=t.dataset.sc==="id"?t.value:num(t.value);if(how.by==="factor"&&!how.x)return;rerenderScale();}
  else if(t.dataset&&t.dataset.pan&&view&&/^(from|to)-/.test(t.dataset.pan)){how.from=readPanCm("from");how.to=readPanCm("to");rerenderScale();}
});
document.addEventListener("change",function(e){
  var t=e.target;
  if(t.id==="sc-by"){var f=byId(view);how={by:t.value,x:1};if(how.by==="pieces"){how.count=f.pieces||1;var a=B.analyze(f);how.each=Math.round(a.total/(f.pieces||1));}if(how.by==="limit")how.id=f.ing[0]&&f.ing[0].id;render();K.track("scale_"+how.by);}
  else if(t.dataset&&t.dataset.sc==="id"&&view){how.id=t.value;rerenderScale();}
  else if(t.dataset&&t.dataset.pan&&view&&/-(shape|unit)$/.test(t.dataset.pan)){var side=t.dataset.pan.split("-")[0];if(side==="from"||side==="to"){var raw=readPan(side);how[side]=raw;render();}}
  else if(t.dataset&&t.dataset.act==="tu"){S.tempUnit=t.value;save();}
  else if(t.id==="restore"&&t.files[0]){var fr=new FileReader(),file=t.files[0];t.value="";fr.onload=function(){if(!confirm("Replace what's in Bake now with this copy?"))return;try{K.restoreCopy(String(fr.result));toast("Restored from your copy.");}catch(x){toast(x&&x.code==="wrongapp"?"That copy is from "+(x.app||"another app")+", not Bake.":"That file isn't a Bake copy.");}};fr.readAsText(file);}
});
function readPanCm(side){var p=readPan(side);p.dcm=p.dcm||0;return p;}
var scT=null;function rerenderScale(){clearTimeout(scT);scT=setTimeout(function(){var ae=document.activeElement,key=ae&&ae.dataset&&(ae.dataset.sc||ae.dataset.pan),pos=ae&&ae.selectionStart;
  if(how.by==="pan"&&how.from&&how.to){how.fromCm=inCm(how.from);how.toCm=inCm(how.to);}
  render();if(key){var el=document.querySelector('[data-sc="'+key+'"],[data-pan="'+key+'"]');if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch(x){}}}},250);}
/* Pan scaling uses centimetre sizes so inches and cm can be mixed. */
var baseFactor=B.factor;B.factor=function(f,h){if(h.by==="pan"){var a=h.from||f.pan,b=h.to;if(!a||!b)return 1;var A=a.dcm||a.wcm?inCm(a):inCm(withCm(a)),C=b.dcm||b.wcm?inCm(b):inCm(withCm(b));return B.panFactor(A,C)||1;}return baseFactor(f,h);};
function withCm(p){var o=Object.assign({},p),cm=p.unit==="cm"?1:2.54;["d","w","l","h","inner"].forEach(function(k){if(p[k])o[k+"cm"]=p[k]*cm;});return o;}

document.addEventListener("click",function(e){
  var b=e.target.closest("[data-act]");if(!b||b.tagName==="SELECT"||(b.tagName==="INPUT"&&b.type!=="button"))return;
  var a=b.dataset.act,id=b.dataset.id;
  if(a==="tab"){tab=b.dataset.t;view=null;render();}
  else if(a==="settings"){tab="settings";view=null;render();}
  else if(a==="close")closeDlg();
  else if(a==="seed"){S.formulas=S.formulas.concat(starters());S.seeded=true;save();render();K.track("starter_formulas");}
  else if(a==="open"){view=id;how={by:"factor",x:1};render();window.scrollTo(0,0);K.track("formula_view");}
  else if(a==="back"){view=null;render();}
  else if(a==="resetscale"){how={by:"factor",x:1};render();}
  else if(a==="print"){K.track("print");window.print();}
  else if(a==="new")editDialog(null);
  else if(a==="edit")editDialog(byId(id));
  else if(a==="addrow"){readRows();editRows.push({id:rid(),name:"",g:"",role:"other"});drawRows();var rs=document.querySelectorAll("#e-rows [data-k=name]");rs[rs.length-1].focus();}
  else if(a==="delrow"){readRows();editRows.splice(+b.dataset.i,1);drawRows();}
  else if(a==="saveformula"){
    readRows();var name=$("#e-name").value.trim();if(!name){toast("Give it a name.");return;}
    var ing=editRows.filter(function(r){return r.name&&num(r.g)!=null;}).map(function(r){var o={id:r.id||rid(),name:r.name.slice(0,60),g:num(r.g),role:r.role};if(r.role==="starter")o.hyd=r.hyd==null?100:r.hyd;return o;});
    if(!ing.length){toast("Add at least one ingredient with grams.");return;}
    var f=byId(id)||{id:id};f.name=name.slice(0,80);f.kind=$("#e-kind").value;f.pieces=Math.max(1,Math.round(num($("#e-pieces").value)||1));f.ing=ing;f.steps=$("#e-steps").value;f.notes=$("#e-notes").value;f.fav=$("#e-fav").checked;
    var p=readPan("e");f.pan=$("#e-nopan").checked||!(p.d||p.w)?null:{shape:p.shape,d:p.d||0,w:p.w||0,l:p.l||0,h:p.h||0,unit:p.unit};
    if(b.dataset.new==="1"){S.formulas.push(f);K.track("formula_add");}else K.track("formula_edit");
    save();closeDlg();view=f.id;how={by:"factor",x:1};render();
  }
  else if(a==="dup"){var src=byId(id),c=JSON.parse(JSON.stringify(src));c.id=rid();c.name=(src.name+" (copy)").slice(0,80);c.ing.forEach(function(i){i.id=rid();});S.formulas.push(c);save();closeDlg();view=c.id;render();K.track("formula_dup");}
  else if(a==="delformula"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again to delete";return;}S.formulas=S.formulas.filter(function(f){return f.id!==id;});save();closeDlg();view=null;render();}
  else if(a==="logbake")logDialog(id,null);
  else if(a==="editlog"){var l=S.log.filter(function(x){return x.id===id;})[0];if(l)logDialog(l.fid,l);}
  else if(a==="savelog"){
    var st=document.querySelector("input[name=st]:checked"),ex=S.log.filter(function(x){return x.id===id;})[0],o=ex||{id:id,fid:b.dataset.f};
    o.d=$("#l-d").value||today();o.k=num($("#l-k").value)||1;o.stars=st?+st.value:0;o.note=$("#l-note").value.slice(0,1000);
    if(!ex){S.log.push(o);K.track("bake_log");}save();closeDlg();render();toast("Logged.");
  }
  else if(a==="dellog"){S.log=S.log.filter(function(x){return x.id!==id;});save();closeDlg();render();}
  else if(a==="convert"){tab="tools";view=null;render();var t=$("#t-conv");if(t){t.scrollIntoView({block:"center"});t.focus();}}
  else if(a==="convsave"){
    var rows=$("#t-conv").value.split(/\n/).map(B.toGrams).filter(function(r){return r&&r.g!=null;});
    var nf={id:rid(),name:"Converted recipe",kind:"other",pieces:1,pan:null,steps:"",notes:"Converted from cups; weigh and adjust.",fav:false,ing:rows.map(function(r){var role=B.guessRole(r.name),o={id:rid(),name:(r.name.charAt(0).toUpperCase()+r.name.slice(1)).slice(0,60),g:r.g,role:role};if(role==="starter")o.hyd=100;return o;})};
    S.formulas.push(nf);save();K.track("convert_save");tab="formulas";editDialog(nf);
  }
  else if(a==="price"){var k=b.dataset.k||"";dlg('<h2>Ingredient price</h2><label class="f">Ingredient<input type="text" id="p-n" value="'+esc(k)+'" placeholder="Butter"></label><label class="f">Price per kg ('+(window.PixoraCountry?PixoraCountry.info().cur:"$")+')<input type="text" inputmode="decimal" id="p-v" value="'+(k?S.prices[k]:"")+'"></label><p class="note">'+(window.PixoraCountry&&PixoraCountry.get()==="IN"?"A 500 g pack of butter at ₹285 is ₹570 per kg.":"A 454 g block of butter at $6.99 is $15.40 per kg.")+'</p><div class="row"><button class="btn p" data-act="saveprice" data-old="'+esc(k)+'">Save</button><button class="btn q" data-act="close">Cancel</button>'+(k?'<button class="btn d" data-act="delprice" data-k="'+esc(k)+'">Delete</button>':"")+'</div>');}
  else if(a==="saveprice"){var nm=$("#p-n").value.trim().toLowerCase(),v=num($("#p-v").value);if(!nm||v==null){toast("Add a name and a price.");return;}if(b.dataset.old&&b.dataset.old!==nm)delete S.prices[b.dataset.old];S.prices[nm]=v;save();closeDlg();render();K.track("price_set");}
  else if(a==="delprice"){delete S.prices[b.dataset.k];save();closeDlg();render();}
  else if(a==="export")K.exportCopy();
  else if(a==="feedback"){if(window.PixoraFeedback)PixoraFeedback.open("bake","Bake");}
  else if(a==="delall"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again: delete everything in Bake";return;}tab="formulas";view=null;K.deleteAppData().then(function(){render();toast("Your Bake data is deleted. Your Pixora login still works.");}).catch(function(){toast("Couldn't delete. Check the connection.");});}
  else if(a==="join")K.joinAccount();
  else if(a==="signout")K.signOut();
});
$("#tabs").addEventListener("click",function(e){var b=e.target.closest("[data-tab]");if(!b)return;tab=b.dataset.tab;view=null;render();K.track("tab_"+tab);});

K.boot({
  app:"bake",title:"Bake",version:"bake-v1",blurb:"Baker's percentages, any batch or pan size, cups to grams, and a bake log.",
  clean:B.clean,
  onOpen:function(s,o){S=s;if(!(o&&o.fresh)&&!S.formulas.length&&!S.seeded){S.formulas=starters();S.seeded=true;save();}else if(o&&o.fresh){S.seeded=true;}view=null;render();},
  onRemote:function(s){S=s;if(!$("#dlg").open)render();},
  onStatus:function(t){var st=$("#st");if(st)st.textContent=t;},
  onGate:function(shown){$("#app").hidden=shown;$("#tabs").hidden=shown;},
  /* For Pixora Today: counts and the latest bake's name and rating only. */
  summary:function(s){
    var ls=s.log.slice().sort(function(a,b){return b.d.localeCompare(a.d);}),last=ls[0],f=last&&s.formulas.filter(function(x){return x.id===last.fid;})[0],m=today().slice(0,7);
    return {d:today(),formulas:s.formulas.length,month:s.log.filter(function(l){return l.d.slice(0,7)===m;}).length,last:last?{n:f?f.name:"",d:last.d,stars:last.stars}:null};
  }
});
