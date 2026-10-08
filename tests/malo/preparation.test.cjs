const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {fixture}=require('../helpers/malo-fixture.cjs');const {createMaloDossier}=require('../../server/modules/malo/malo-dossier.service.ts');
const {prepareMaloLot,addMaloInputs}=require('../../server/modules/malo/malo-preparation.service.ts');
const {snapshotOf,readLot}=require('../../server/modules/malo/malo-operation.ts');
const at='2026-10-01T08:00:00Z';
test('préparation parallèle, intrants regroupés et rollback stock', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async({tx,actor,tank,wine})=>{
 const {preparationId:id}=await createMaloDossier({name:'Malo',year:2026,profile:'CO_INOCULATION',plannedVolumeHl:100,idempotencyKey:randomUUID()},actor);
 const source=await wine('Taille');const mrTank=await tank('MR',5),pcmTank=await tank('PCM',10);
 const product=await tx.product.create({data:{organizationId:actor.organizationId,name:'Bactéries choisies',category:'Intrants',subCategory:'Bactéries',unit:'kg',currentStock:1}});
 const inputs={sources:[{lotId:source.id,volumeHl:0.75,expectedVolumeHl:100}],waterVolumeHl:0.75,products:[{productId:product.id,role:'BACTERIES',quantity:600,unit:'g',addedVolumeHl:0}]};
 const request={role:'MR',name:'MR',destinationContainerId:mrTank.id,recipe:inputs,performedAt:at,idempotencyKey:randomUUID()};
 await prepareMaloLot(id,request,actor);await assert.rejects(()=>prepareMaloLot(id,request,actor));
 await prepareMaloLot(id,{role:'PCM',name:'PCM',destinationContainerId:pcmTank.id,recipe:{sources:[{lotId:source.id,volumeHl:3,expectedVolumeHl:99.25}],waterVolumeHl:0,products:[]},performedAt:at,idempotencyKey:randomUUID()},actor);
 assert.equal(Number((await tx.product.findUnique({where:{id:product.id}})).currentStock),0.4);
 const mr=await tx.lot.findFirst({where:{maloPreparationId:id,maloRole:'MR'}});assert.equal(Number(mr.currentVolume),1.5);
 const snapshot=await snapshotOf(tx,await readLot(tx,mr.id,actor),actor);
 await assert.rejects(()=>addMaloInputs(id,{snapshot,performedAt:at,idempotencyKey:randomUUID(),recipe:{sources:[],waterVolumeHl:1,products:[{productId:product.id,role:'BACTERIES',quantity:300,unit:'g',addedVolumeHl:0},{productId:product.id,role:'AUTRE',quantity:300,unit:'g',addedVolumeHl:0}]}},actor));
 assert.equal(Number((await tx.lot.findUnique({where:{id:mr.id}})).currentVolume),1.5);
 assert.equal(await tx.lot.count({where:{maloPreparationId:id}}),2);
}));
test('ancien levain, produit étranger et source=destination refusés sans débit', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async({tx,actor,tank,wine})=>{
 const {preparationId:id}=await createMaloDossier({name:'Protection',year:2026,profile:'CUSTOM',plannedVolumeHl:100,idempotencyKey:randomUUID()},actor);const source=await wine('Cuve Levain');const c=await tank('MR',5);
 const req={role:'MR',name:'MR',destinationContainerId:c.id,recipe:{sources:[{lotId:source.id,volumeHl:1,expectedVolumeHl:100}],waterVolumeHl:0,products:[]},performedAt:at,idempotencyKey:randomUUID()};
 await assert.rejects(()=>prepareMaloLot(id,req,actor));assert.equal(Number((await tx.lot.findUnique({where:{id:source.id}})).currentVolume),100);
 const ordinary=await wine('Vin');await assert.rejects(()=>prepareMaloLot(id,{...req,destinationContainerId:ordinary.currentContainerId,recipe:{...req.recipe,sources:[{lotId:ordinary.id,volumeHl:1,expectedVolumeHl:100}]}},actor));
 const org=await tx.organization.create({data:{name:'Autre',slug:randomUUID()}});const p=await tx.product.create({data:{organizationId:org.id,name:'Étranger',category:'Intrants',subCategory:'Bactéries',unit:'kg',currentStock:10}});
 await assert.rejects(()=>prepareMaloLot(id,{...req,recipe:{...req.recipe,sources:[{lotId:ordinary.id,volumeHl:1,expectedVolumeHl:100}],products:[{productId:p.id,role:'BACTERIES',quantity:1,unit:'kg',addedVolumeHl:0}]}},actor));assert.equal(Number((await tx.lot.findUnique({where:{id:ordinary.id}})).currentVolume),100);assert.equal(await tx.lot.count({where:{maloPreparationId:id}}),0);
}));
test('contenant réutilisé : nouveaux lots, anciens liens conservés', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async f=>{
 const {setup}=require('../helpers/malo-cycle.cjs');const s=await setup(f);const mr=await f.tx.lot.findUnique({where:{id:s.mr}});const originalContainer=mr.currentContainerId;await s.transfer('MR_TO_PCM',s.mr,s.pcm,1.5);
 await f.tx.container.update({where:{id:originalContainer},data:{status:'VIDE',usage:null}});
 const {preparationId:id}=await createMaloDossier({name:'Suivante',year:2026,profile:'CO_INOCULATION',plannedVolumeHl:100,idempotencyKey:randomUUID()},f.actor);const source=await f.wine('Taille suivante');await prepareMaloLot(id,{role:'MR',name:'MR suivant',destinationContainerId:originalContainer,recipe:{sources:[{lotId:source.id,volumeHl:1,expectedVolumeHl:100}],waterVolumeHl:.5,products:[]},performedAt:'2026-10-03T08:00:00Z',idempotencyKey:randomUUID()},f.actor);
 const next=await f.tx.lot.findFirst({where:{maloPreparationId:id,maloRole:'MR'}});assert.notEqual(next.id,mr.id);assert.equal(next.currentContainerId,originalContainer);const old=await f.tx.lot.findUnique({where:{id:mr.id}});assert.equal(Number(old.currentVolume),0);assert.equal(old.maloPreparationId,s.id);assert.ok(await f.tx.lotEventContainer.count({where:{containerId:originalContainer,event:{lots:{some:{lotId:mr.id}}}}}));
}));
