/* Bake core: baker's math, scaling, pan resizing, cups-to-grams, water temperature, costing. No DOM. */
(function(root){
"use strict";
function n(v){v=+v;return isFinite(v)?v:0;}
function r1(v){return Math.round(v*10)/10;}
function str(v,k){return String(v==null?"":v).slice(0,k);}

/* Roles: flour counts as 100%; water and starter feed hydration. A starter (levain) is split into its
   flour and water by its own hydration so totals are true baker's percentages. */
var ROLES=[["flour","Flour"],["water","Water / liquid"],["starter","Starter (levain)"],["egg","Egg"],["fat","Butter / oil"],["sugar","Sugar"],["salt","Salt"],["yeast","Yeast / leavening"],["other","Other"]];
/* How much of an ingredient is water, for hydration. Approximate, common values. */
var WATERY={water:1,milk:0.87,"buttermilk":0.9,cream:0.6,"heavy cream":0.58,yogurt:0.85,egg:0.75,eggs:0.75,"egg white":0.88,"egg whites":0.88,"egg yolk":0.5,"egg yolks":0.5,butter:0.16,juice:0.88,coffee:0.99,beer:0.92};
function waterPart(ing){
  var nm=String(ing.name||"").toLowerCase();
  if(ing.role==="water")return n(ing.g)*(WATERY[nm]!=null?WATERY[nm]:pick(nm,1));
  if(ing.role==="egg")return n(ing.g)*pick(nm,0.75);
  if(ing.role==="starter")return n(ing.g)*sh(ing)/(1+sh(ing));
  if(ing.role==="fat"&&/butter/.test(nm))return n(ing.g)*0.16;
  return 0;
}
function pick(nm,d){for(var k in WATERY)if(nm.indexOf(k)>=0)return WATERY[k];return d;}
function sh(ing){return Math.max(0,n(ing.hyd!=null&&ing.hyd!==""?ing.hyd:100))/100;}
function flourPart(ing){
  if(ing.role==="flour")return n(ing.g);
  if(ing.role==="starter")return n(ing.g)/(1+sh(ing));
  return 0;
}
/* Totals, baker's percentages and hydration. */
function analyze(f){
  var ing=f.ing||[],flour=0,water=0,total=0;
  ing.forEach(function(i){flour+=flourPart(i);water+=waterPart(i);total+=n(i.g);});
  return {flour:r1(flour),water:r1(water),total:r1(total),hydration:flour?r1(100*water/flour):null,
    pct:ing.map(function(i){return flour?r1(100*n(i.g)/flour):null;})};
}
/* Scaling: returns a multiplier. how = {by:"factor"|"total"|"pieces"|"flour"|"limit", ...} */
function factor(f,how){
  var a=analyze(f);
  if(how.by==="factor")return Math.max(0,n(how.x))||1;
  if(how.by==="total")return a.total?n(how.g)/a.total:1;
  if(how.by==="pieces")return a.total?n(how.count)*n(how.each)/a.total:1;
  if(how.by==="flour")return a.flour?n(how.g)/a.flour:1;
  if(how.by==="limit"){var i=(f.ing||[]).filter(function(x){return x.id===how.id;})[0];return i&&n(i.g)?n(how.g)/n(i.g):1;}
  if(how.by==="pan")return panFactor(how.from,how.to);
  return 1;
}
function scaled(f,k){return (f.ing||[]).map(function(i){return {id:i.id,name:i.name,role:i.role,g:Math.round(n(i.g)*k*10)/10};});}

/* Pans: round {shape:"round",d}, square {shape:"square",w}, rect {shape:"rect",w,l}. Sizes in the same unit.
   Depth is optional (h); when both have it, volume is used. */
function panArea(p){
  if(!p)return 0;
  if(p.shape==="round")return Math.PI*Math.pow(n(p.d)/2,2);
  if(p.shape==="square")return n(p.w)*n(p.w);
  if(p.shape==="rect")return n(p.w)*n(p.l);
  if(p.shape==="bundt"||p.shape==="tube")return Math.PI*(Math.pow(n(p.d)/2,2)-Math.pow(n(p.inner||0)/2,2));
  return 0;
}
function panFactor(a,b){var A=panArea(a),B=panArea(b);if(!A||!B)return 1;var k=B/A;if(n(a.h)&&n(b.h))k*=n(b.h)/n(a.h);return k;}

/* Cups and spoons to grams by ingredient. Approximate values for spooned-and-levelled measuring; weighing is best. */
var DENSITY=[ // [match, grams per cup]
  [/bread flour/,120],[/cake flour|pastry flour/,113],[/whole ?wheat flour|wholemeal/,113],[/almond flour|almond meal|ground almond/,96],[/rice flour/,158],[/semolina/,163],[/rye flour/,106],[/oat flour/,92],
  [/all[- ]purpose|\bap flour\b|plain flour|\bflour\b/,120],
  [/brown sugar/,213],[/icing sugar|powdered sugar|confectioners/,113],[/caster sugar|superfine/,200],[/\bsugar\b|granulated/,198],
  [/butter/,227],[/vegetable oil|canola|olive oil|\boil\b/,198],[/ghee/,220],[/shortening/,184],
  [/honey/,336],[/maple syrup/,312],[/molasses/,337],[/corn syrup|golden syrup/,328],
  [/heavy cream|whipping cream|\bcream\b/,232],[/buttermilk/,242],[/milk/,242],[/water/,236],[/yogurt|yoghurt/,245],[/sour cream/,242],[/cream cheese/,232],[/ricotta/,246],[/mascarpone/,225],
  [/cocoa/,84],[/cornstarch|corn starch|cornflour/,128],[/rolled oats|\boats\b/,90],[/chocolate chips|chocolate chunks/,170],[/chopped (nuts|walnuts|pecans|almonds)|walnuts|pecans/,113],
  [/raisins|sultanas/,149],[/shredded coconut|desiccated coconut/,85],[/peanut butter/,270],[/sprinkles/,180],[/poppy seeds/,140],[/sesame seeds/,144],
  [/pumpkin puree|pumpkin purée/,244],[/mashed banana|banana/,225],[/applesauce/,255]
];
/* Small things are best per teaspoon. */
var PER_TSP=[[/instant yeast|active dry yeast|\byeast\b/,3.1],[/baking powder/,4],[/baking soda|bicarbonate/,6],[/diamond crystal|kosher salt/,2.8],[/morton kosher/,4.8],[/\bsalt\b/,6],[/vanilla/,4.2],[/cinnamon|cardamom|nutmeg|ginger|spice/,2.6],[/cream of tartar/,3.1]];
var UNITS={cup:1,cups:1,c:1,tbsp:1/16,tablespoon:1/16,tablespoons:1/16,tbs:1/16,tsp:1/48,teaspoon:1/48,teaspoons:1/48,"fl oz":1/8,ml:1/236.6,l:1000/236.6};
var FRAC={"½":0.5,"¼":0.25,"¾":0.75,"⅓":1/3,"⅔":2/3,"⅛":0.125};
function parseQty(s){
  s=s.replace(/[½¼¾⅓⅔⅛]/g,function(c){return " "+FRAC[c];}).trim();
  var m=/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)/.exec(s);if(m)return {q:+m[1]+m[2]/m[3],rest:s.slice(m[0].length)};
  m=/^(\d+)\/(\d+)/.exec(s);if(m)return {q:m[1]/m[2],rest:s.slice(m[0].length)};
  m=/^(\d+(?:\.\d+)?)\s+(0?\.\d+)/.exec(s);if(m)return {q:+m[1]+(+m[2]),rest:s.slice(m[0].length)};
  m=/^(\d+(?:\.\d+)?)/.exec(s);if(m)return {q:+m[1],rest:s.slice(m[0].length)};
  return null;
}
/* "1 1/2 cups all-purpose flour" -> {g:180, name:"all-purpose flour", from:"1 1/2 cups"} */
function toGrams(line){
  var t=String(line||"").trim().replace(/^[-•*]\s*/,"");if(!t)return null;
  var p=parseQty(t);if(!p)return {g:null,name:t,from:"",why:"no amount"};
  var rest=p.rest.trim(),lr=rest.toLowerCase(),m;
  if((m=/^(g|grams?|gr)\b\.?\s*/.exec(lr)))return {g:r1(p.q),name:rest.slice(m[0].length).replace(/^of\s+/,""),from:""};
  if((m=/^(kg|kilograms?)\b\.?\s*/.exec(lr)))return {g:r1(p.q*1000),name:rest.slice(m[0].length),from:""};
  if((m=/^(oz|ounces?)\b\.?\s*/.exec(lr)))return {g:r1(p.q*28.35),name:rest.slice(m[0].length),from:p.q+" oz"};
  if((m=/^(lb|lbs|pounds?)\b\.?\s*/.exec(lr)))return {g:r1(p.q*453.6),name:rest.slice(m[0].length),from:p.q+" lb"};
  if((m=/^(large |medium |small |extra[- ]large )?(eggs?|egg whites?|egg yolks?)\b/.exec(lr))){
    var each=/white/.test(m[2])?33:/yolk/.test(m[2])?18:(m[1]&&/extra/.test(m[1])?56:m[1]&&/medium/.test(m[1])?44:m[1]&&/small/.test(m[1])?38:50);
    return {g:r1(p.q*each),name:rest,from:p.q+" × "+each+" g",egg:true};
  }
  var unit=null,u;
  for(u in UNITS){var re=new RegExp("^"+u.replace(" ","\\s")+"s?\\b\\.?\\s*");if(re.test(lr)){unit=u;m=re.exec(lr);break;}}
  if(!unit)return {g:null,name:rest,from:"",why:"no unit"};
  var name=rest.slice(m[0].length).replace(/^of\s+/,""),nl=name.toLowerCase(),cups=p.q*UNITS[unit];
  if(unit==="ml"||unit==="l")return {g:r1(p.q*(unit==="l"?1000:1)*(/oil/.test(nl)?0.92:/honey|syrup/.test(nl)?1.4:1)),name:name,from:p.q+" "+unit};
  if(UNITS[unit]<=1/16){var tsp=cups*48;for(var i=0;i<PER_TSP.length;i++)if(PER_TSP[i][0].test(nl))return {g:r1(tsp*PER_TSP[i][1]),name:name,from:p.q+" "+unit};}
  for(var j=0;j<DENSITY.length;j++)if(DENSITY[j][0].test(nl))return {g:r1(cups*DENSITY[j][1]),name:name,from:p.q+" "+unit};
  return {g:null,name:name,from:p.q+" "+unit,why:"unknown ingredient"};
}
function guessRole(name){
  var s=String(name||"").toLowerCase();
  if(/starter|levain|poolish|biga|sourdough/.test(s))return "starter";
  if(/flour|semolina|meal\b/.test(s)&&!/almond/.test(s))return "flour";
  if(/^water|milk|buttermilk|cream\b|juice|coffee|beer/.test(s))return "water";
  if(/egg/.test(s))return "egg";
  if(/butter|oil|ghee|shortening/.test(s))return "fat";
  if(/sugar|honey|syrup|molasses/.test(s))return "sugar";
  if(/salt/.test(s))return "salt";
  if(/yeast|baking powder|baking soda|bicarbonate/.test(s))return "yeast";
  return "other";
}

/* Water temperature for a target dough temperature (°C). friction = how much the mixer warms the dough. */
function waterTemp(o){
  var k=o.starter?4:3,sum=n(o.room)+n(o.flour)+n(o.friction)+(o.starter?n(o.starterT):0);
  return r1(n(o.target)*k-sum);
}
/* Whole eggs for an egg weight. */
function eggs(g,each){each=each||50;return {count:Math.round(n(g)/each),exact:r1(n(g)/each)};}

/* Cost of a batch from $ per kg prices keyed by lower-case ingredient name. */
function cost(f,prices,k){
  k=k||1;var total=0,missing=[];
  (f.ing||[]).forEach(function(i){var nm=String(i.name||"").toLowerCase().trim();if(/^(tap |warm |cold |ice )?water$/.test(nm))return;var p=prices&&prices[nm];if(p==null||p===""){missing.push(i.name);return;}total+=n(i.g)*k/1000*n(p);});
  return {total:Math.round(total*100)/100,missing:missing};
}

var KINDS=[["bread","Bread"],["pizza","Pizza"],["cake","Cake"],["cookie","Cookies"],["pastry","Pastry"],["other","Other"]];
function clean(s){
  s=s&&typeof s==="object"?s:{};
  var o={ts:+s.ts||0,formulas:[],prices:{},log:[],tempUnit:s.tempUnit==="F"?"F":"C",seeded:!!s.seeded};
  (Array.isArray(s.formulas)?s.formulas:[]).slice(0,300).forEach(function(f){
    if(!f||!f.id)return;
    o.formulas.push({id:str(f.id,24),name:str(f.name,80),kind:KINDS.some(function(k){return k[0]===f.kind;})?f.kind:"other",fav:!!f.fav,
      ing:(Array.isArray(f.ing)?f.ing:[]).slice(0,40).filter(function(i){return i&&i.name;}).map(function(i){var role=ROLES.some(function(r){return r[0]===i.role;})?i.role:guessRole(i.name),o={id:str(i.id||Math.random().toString(36).slice(2,8),24),name:str(i.name,60),g:n(i.g),role:role};if(role==="starter")o.hyd=i.hyd===undefined||i.hyd===""?100:n(i.hyd);return o;}),
      pieces:Math.max(0,Math.round(n(f.pieces))),pan:f.pan&&typeof f.pan==="object"?{shape:str(f.pan.shape,8),d:n(f.pan.d),w:n(f.pan.w),l:n(f.pan.l),h:n(f.pan.h),unit:f.pan.unit==="cm"?"cm":"in"}:null,
      steps:str(f.steps,4000),notes:str(f.notes,2000)});
  });
  if(s.prices&&typeof s.prices==="object")Object.keys(s.prices).slice(0,200).forEach(function(k){var v=n(s.prices[k]);if(v>0)o.prices[str(k,60).toLowerCase()]=v;});
  (Array.isArray(s.log)?s.log:[]).slice(-500).forEach(function(l){if(l&&l.id&&/^\d{4}-\d{2}-\d{2}$/.test(l.d))o.log.push({id:str(l.id,24),fid:str(l.fid,24),d:l.d,k:n(l.k)||1,stars:Math.min(5,Math.max(0,Math.round(n(l.stars)))),note:str(l.note,1000)});});
  return o;
}
var api={ROLES:ROLES,KINDS:KINDS,analyze:analyze,factor:factor,scaled:scaled,panArea:panArea,panFactor:panFactor,toGrams:toGrams,guessRole:guessRole,parseQty:parseQty,waterTemp:waterTemp,eggs:eggs,cost:cost,clean:clean};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.BakeCore=api;
})(typeof self!=="undefined"?self:this);
