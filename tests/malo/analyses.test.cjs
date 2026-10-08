const test=require('node:test');const assert=require('node:assert/strict');
const {validateMaloAnalysisContext}=require('../../server/modules/malo/malo-control.service.ts');
test('contrôle importé après dilution ne devient pas représentatif',()=>{
 const lot={id:1,maloRole:'PCM',maloPreparationId:1,currentContainerId:3,maloCompositionEventId:8};
 assert.throws(()=>validateMaloAnalysisContext(lot,{preparationId:1,role:'PCM',containerId:3,compositionEventId:7,sampledAt:'2026-10-08T08:00:00Z'},new Date('2026-10-08T09:00:00Z')));
 assert.throws(()=>validateMaloAnalysisContext(lot,{preparationId:1,role:'PCM',containerId:3,compositionEventId:8,sampledAt:'2026-10-08T08:00:00Z'},new Date('2026-10-08T09:00:00Z')));
 assert.doesNotThrow(()=>validateMaloAnalysisContext(lot,{preparationId:1,role:'PCM',containerId:3,compositionEventId:8,sampledAt:'2026-10-08T10:00:00Z'},new Date('2026-10-08T09:00:00Z')));
});
const {fixture,prisma}=require('../helpers/malo-fixture.cjs');const {randomUUID}=require('node:crypto');const {setup}=require('../helpers/malo-cycle.cjs');const {AnalysesService}=require('../../services/analyses.service.ts');
test('saisie réelle conserve zéro, contexte et données inconnues', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async f=>{
 const s=await setup(f),lot=await f.tx.lot.findUnique({where:{id:s.mr}}),date='2026-10-02T10:00:00Z';const original=prisma.$transaction;prisma.$transaction=async work=>work(f.tx);
 try{await AnalysesService.saveRecords({idempotencyKey:randomUUID(),analyses:[{lotId:lot.id,analysisDate:date,so2Free:0,so2Total:0,alcohol:0,at:0,extraData:{malique:0,customLabField:'conservé',malo:{preparationId:s.id,role:'MR',containerId:lot.currentContainerId,compositionEventId:lot.maloCompositionEventId,sampledAt:date}}}]},f.actor.email,f.actor.organizationId);
 const a=await f.tx.analysis.findFirst({where:{lotId:lot.id}});assert.equal(a.so2Free,0);assert.equal(a.so2Total,0);assert.equal(a.alcohol,0);assert.equal(a.extraData.malique,0);assert.equal(a.extraData.customLabField,'conservé');assert.equal(a.extraData.malo.compositionEventId,lot.maloCompositionEventId);
 }finally{prisma.$transaction=original}
}));
