const test=require('node:test');const assert=require('node:assert/strict');
const {fixture}=require('../helpers/malo-fixture.cjs');const {setup}=require('../helpers/malo-cycle.cjs');const {TracabiliteService}=require('../../services/tracabilite.service.ts');
test('généalogie MR ↔ PCM bornée et historique conservé après vidange', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async f=>{
 const s=await setup(f);await s.transfer('PCM_TO_MR',s.pcm,s.mr,1.5);await s.transfer('MR_TO_PCM',s.mr,s.pcm,3);
 const mr=await f.tx.lot.findUnique({where:{id:s.mr}}),pcm=await f.tx.lot.findUnique({where:{id:s.pcm}});
 const result=await TracabiliteService.getLineage({lotCode:pcm.businessCode,type:'bulk'},f.actor.organizationId,f.tx);
 assert.equal(result.parents.filter(x=>x.id===mr.id).length,1);assert.equal(result.children.filter(x=>x.id===mr.id).length,1);assert.ok(result.parents.every(x=>x.id!==pcm.id));assert.ok(result.children.every(x=>x.id!==pcm.id));
 const events=await f.tx.lotEvent.findMany({where:{organizationId:f.actor.organizationId,eventType:{in:['DOUBLEMENT_MR','INCORPORATION_MR']}},include:{lots:true,containers:true}});
 assert.equal(events.length,2);assert.ok(events.every(e=>e.lots.some(x=>x.lotId===mr.id)&&e.lots.some(x=>x.lotId===pcm.id)));assert.equal(mr.maloPreparationId,s.id);
}));
