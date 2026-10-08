const test=require('node:test');const assert=require('node:assert/strict');
const {createMaloDossier,updateMaloDossier}=require('../../server/modules/malo/malo-dossier.service.ts');
const {fixture}=require('../helpers/malo-fixture.cjs');
test('dossier conserve dose et protocole, et refuse références étrangères', {skip:!process.env.MALO_TEST_DATABASE},async()=>fixture(async({tx,actor})=>{
 const p=await createMaloDossier({name:'Malo 2026',year:2026,plannedVolumeHl:100,profile:'CO_INOCULATION',idempotencyKey:require('node:crypto').randomUUID()},actor);
 const saved=await tx.maloPreparation.findUnique({where:{id:p.preparationId}});
 assert.equal(Number(saved.dosePct),4);assert.equal(saved.protocolSnapshot.profile,'CO_INOCULATION');
 await updateMaloDossier(saved.id,{dosePct:3.5,idempotencyKey:require('node:crypto').randomUUID()},actor);
 assert.equal(Number((await tx.maloPreparation.findUnique({where:{id:saved.id}})).dosePct),3.5);
 await assert.rejects(()=>updateMaloDossier(saved.id,{plannedDestinations:[{lotId:999999,dosePct:4}],idempotencyKey:require('node:crypto').randomUUID()},actor));
}));
