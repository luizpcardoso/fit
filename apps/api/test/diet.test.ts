import assert from "node:assert/strict";
import test from "node:test";
import {
  dietMacros,
  dietOptionName,
  dietMealInputSchema,
  portalContentSnapshotSchema,
  dietMealOptions,
  portalContentInputSchema,
} from "@fit/contracts";
test("macros proporcionais, opções independentes e compatibilidade com dietas antigas", () => {
  const item = {
    food: {
      name: "Leite",
      servingAmount: 200,
      servingUnit: "ml" as const,
      calories: 120,
      protein: 6,
      carbs: 10,
      fat: 6,
      notes: "",
    },
    quantity: 100,
    substitutions: "",
  };
  assert.deepEqual(dietMacros([item]), {
    calories: 60,
    protein: 3,
    carbs: 5,
    fat: 3,
  });
  assert.equal(dietMacros([item], [300]).calories, 180);
  assert.equal(
    dietMealOptions({ name: "Café", time: null, items: [item] }).length,
    1,
  );
  const options = dietMealOptions({
    name: "Café",
    time: null,
    items: [item],
    options: [{ name: "Dobro", items: [{ ...item, quantity: 200 }] }],
  });
  assert.equal(options[0].macros.calories, 60);
  assert.equal(options[1].macros.calories, 120);
  const input = {
    kind: "diet",
    scope: "private",
    name: "Dieta",
    data: {
      objective: "",
      notes: "",
      validityDays: null,
      meals: [
        {
          name: "Café",
          time: null,
          items: [item],
          options: [{ name: "Vazia", items: [] }],
        },
      ],
    },
  };
  assert.equal(portalContentInputSchema.safeParse(input).success, false);
});


test("dietas têm de uma a três opções com nomes fixos, sem alterar snapshots antigos", () => {
  const item = {food:{name:"Arroz",servingAmount:100,servingUnit:"g",calories:130,protein:3,carbs:28,fat:1,notes:""},quantity:100,substitutions:""};
  const input = {kind:"diet",scope:"private",name:"Plano",data:{objective:"",validityDays:null,notes:"",meals:[{name:"Almoço",time:null,items:[item],options:[] as {name?:string;items:typeof item[]}[]}]}};
  for (const count of [0,1,2]) {
    input.data.meals[0].options = Array.from({length:count},()=>({name:"Nome livre",items:[item]}));
    const parsed = portalContentInputSchema.parse(input);
    assert.equal(parsed.kind,"diet");
    if (parsed.kind !== "diet") throw new Error("Esperado plano alimentar");
    assert.deepEqual(dietMealOptions(parsed.data.meals[0]).map(option=>option.name),["Almoço A","Almoço B","Almoço C"].slice(0,count+1));
    assert.deepEqual(parsed.data.meals[0].options?.map(option=>option.name),["Almoço B","Almoço C"].slice(0,count));
  }
  input.data.meals[0].options = [{items:[item]}];
  assert.equal(portalContentInputSchema.safeParse(input).success,true);
  input.data.meals[0].options = Array.from({length:5},()=>({name:"Opção antiga",items:[item]}));
  assert.equal(portalContentInputSchema.safeParse(input).success,false);
  const legacy = portalContentSnapshotSchema.parse(input);
  assert.equal(legacy.kind,"diet");
  if (legacy.kind === "diet") {
    assert.equal(legacy.data.meals[0].options?.length,5);
    assert.equal(dietMealOptions(legacy.data.meals[0]).length,3);
  }
  assert.equal(input.data.meals[0].options.length,5);
  assert.equal(dietOptionName("Jantar",2),"Jantar C");
  assert.equal(dietMealInputSchema.shape.optionIndex.safeParse(2).success,true);
  assert.equal(dietMealInputSchema.shape.optionIndex.safeParse(3).success,false);
});
