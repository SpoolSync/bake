var B=require("../bake-core.js"),assert=require("assert"),n=0;function t(a,f){f();n++;console.log("ok  "+a);}
var loaf={ing:[{id:"a",name:"Bread flour",g:500,role:"flour"},{id:"b",name:"Water",g:350,role:"water"},{id:"c",name:"Salt",g:10,role:"salt"},{id:"d",name:"Instant yeast",g:5,role:"yeast"}]};
t("baker's percentages and hydration",function(){var a=B.analyze(loaf);assert.strictEqual(a.flour,500);assert.strictEqual(a.hydration,70);assert.deepStrictEqual(a.pct,[100,70,2,1]);assert.strictEqual(a.total,865);});
t("starter splits into flour and water",function(){var f={ing:[{name:"Bread flour",g:400,role:"flour"},{name:"Water",g:300,role:"water"},{name:"Starter",g:100,role:"starter",hyd:100}]};var a=B.analyze(f);assert.strictEqual(a.flour,450);assert.strictEqual(a.water,350);assert.strictEqual(a.hydration,77.8);});
t("milk and eggs count partly as water",function(){var a=B.analyze({ing:[{name:"Flour",g:100,role:"flour"},{name:"Milk",g:100,role:"water"},{name:"Eggs",g:50,role:"egg"}]});assert.strictEqual(a.hydration,124.5);});
t("scaling",function(){
  assert.strictEqual(B.factor(loaf,{by:"factor",x:2}),2);
  assert.strictEqual(Math.round(B.factor(loaf,{by:"pieces",count:4,each:250})*1000)/1000,1.156);
  assert.strictEqual(B.factor(loaf,{by:"flour",g:1000}),2);
  assert.strictEqual(B.factor(loaf,{by:"limit",id:"b",g:175}),0.5);
  assert.deepStrictEqual(B.scaled(loaf,0.5).map(function(x){return x.g;}),[250,175,5,2.5]);
});
t("pan resize by area",function(){
  var k=B.panFactor({shape:"round",d:8},{shape:"round",d:9});assert.strictEqual(Math.round(k*1000)/1000,1.266);
  assert.strictEqual(Math.round(B.panFactor({shape:"round",d:9},{shape:"rect",w:9,l:13})*100)/100,1.84);
  assert.strictEqual(B.panFactor({shape:"square",w:8,h:2},{shape:"square",w:8,h:3}),1.5);
});
t("cups to grams",function(){
  assert.strictEqual(B.toGrams("1 1/2 cups all-purpose flour").g,180);
  assert.strictEqual(B.toGrams("1/2 cup butter").g,113.5);
  assert.strictEqual(B.toGrams("2 tsp baking powder").g,8);
  assert.strictEqual(B.toGrams("1 tsp salt").g,6);
  assert.strictEqual(B.toGrams("¾ cup brown sugar").g,159.8);
  assert.strictEqual(B.toGrams("2 large eggs").g,100);
  assert.strictEqual(B.toGrams("250 g bread flour").g,250);
  assert.strictEqual(B.toGrams("8 oz cream cheese").g,226.8);
  assert.strictEqual(B.toGrams("1 cup mystery powder").g,null);
  assert.strictEqual(B.toGrams("1 tbsp honey").g,21);
});
t("water temperature and eggs",function(){
  assert.strictEqual(B.waterTemp({target:25,room:22,flour:21,friction:8}),24);
  assert.deepStrictEqual(B.eggs(165),{count:3,exact:3.3});
});
t("costing",function(){var c=B.cost(loaf,{"bread flour":2.5,salt:1.2},2);assert.strictEqual(c.total,2.52);assert.deepStrictEqual(c.missing,["Instant yeast"]);});
t("clean keeps shape and guesses roles",function(){var s=B.clean({formulas:[{id:"x",name:"Loaf",ing:[{name:"Bread flour",g:"500"},{name:"Sourdough starter",g:100}]}],prices:{"Bread Flour":"2.5"}});
  assert.strictEqual(s.formulas[0].ing[0].role,"flour");assert.strictEqual(s.formulas[0].ing[1].role,"starter");assert.strictEqual(s.formulas[0].ing[1].hyd,100);assert.strictEqual(s.prices["bread flour"],2.5);});
console.log(n+" tests passed");
