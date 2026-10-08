const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {fixture}=require('../helpers/malo-fixture.cjs');const {createMaloDossier}=require('../../server/modules/malo/malo-dossier.service.ts');const {addMaloInputs,prepareMaloLot}=require('../../server/modules/malo/malo-preparation.service.ts');const {transferMalo}=require('../../server/modules/malo/malo-transfer.service.ts');const {distributeMalo}=require('../../server/modules/malo/malo-distribution.service.ts');const {confirmMaloHomogenization,setMaloInitialReference,readMaloControl}=require('../../server/modules/malo/malo-control.service.ts');const {readLot,snapshotOf}=require('../../server/modules/malo/malo-operation.ts');
const at='2026-10-01T08:00:00Z';
const {setup}=require('../helpers/malo-cycle.cjs');
test('schéma CIVC : doublement puis retour sans double volume', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async f=>{
 const {tx,actor}=f;const s=await setup(f);
 await s.transfer('PCM_TO_MR',s.pcm,s.mr,1.5);
 assert.equal(Number((await tx.lot.findUnique({where:{id:s.pcm}})).currentVolume),23.25);assert.equal(Number((await tx.lot.findUnique({where:{id:s.mr}})).currentVolume),3);
 await s.transfer('MR_TO_PCM',s.mr,s.pcm,3);
 assert.equal(Number((await tx.lot.findUnique({where:{id:s.pcm}})).currentVolume),26.25);assert.equal(Number((await tx.lot.findUnique({where:{id:s.mr}})).currentVolume),0);
}));
test('distribution multi-cuves, critères, capacité et doublon', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async f=>{
 const {tx,actor,wine}=f,s=await setup(f);await s.transfer('MR_TO_PCM',s.mr,s.pcm,1.5);
 const before=await s.snap(s.pcm);const target=await wine('Cible',100,110),target2=await wine('Cible2',50,60),tooSmall=await wine('Petite',100,103);
 await assert.rejects(()=>distributeMalo(s.id,{snapshot:before,destinations:[{lotId:target.id,snapshot:{...before,lotId:target.id},volumeHl:4}],initialAnalysisId:1,currentAnalysisId:2,confirmed:true,performedAt:at,idempotencyKey:randomUUID()},actor));
 await confirmMaloHomogenization(s.id,{snapshot:await s.snap(s.pcm),performedAt:'2026-10-02T09:00:00Z',confirmed:true,idempotencyKey:randomUUID()},actor);
 const l=await tx.lot.findUnique({where:{id:s.pcm}});
 const analysis=async(value,date)=>tx.analysis.create({data:{organizationId:actor.organizationId,lotId:l.id,analysisDate:new Date(date),extraData:{malique:value,malo:{schemaVersion:1,preparationId:s.id,role:'PCM',containerId:l.currentContainerId,compositionEventId:l.maloCompositionEventId,sampledAt:date}}}});
 const initial=await analysis(6,'2026-10-02T10:00:00Z');await setMaloInitialReference(s.id,{snapshot:await s.snap(s.pcm),analysisId:initial.id,performedAt:'2026-10-02T11:00:00Z',idempotencyKey:randomUUID()},actor);const current=await analysis(2,'2026-10-07T08:00:00Z');
 const dest=async l=>({lotId:l.id,snapshot:await s.snap(l.id),volumeHl:Number(l.currentVolume)*.04});
 const request=async destinations=>({snapshot:await s.snap(s.pcm),destinations,initialAnalysisId:initial.id,currentAnalysisId:current.id,confirmed:true,performedAt:'2026-10-08T08:00:00Z',idempotencyKey:randomUUID()});
 await assert.rejects(()=>request([]).then(x=>distributeMalo(s.id,x,actor)));
 await assert.rejects(async()=>distributeMalo(s.id,await request([await dest(target),await dest(tooSmall)]),actor));
 assert.equal(Number((await tx.lot.findUnique({where:{id:target.id}})).currentVolume),100);assert.equal(Number((await tx.lot.findUnique({where:{id:s.pcm}})).currentVolume),26.25);
 const shared=await wine('Partagée',100,110),other=await wine('Autre lot',7,20);await tx.lot.update({where:{id:other.id},data:{currentContainerId:shared.currentContainerId}});await assert.rejects(async()=>distributeMalo(s.id,await request([await dest(shared)]),actor));
 const body=await request([await dest(target),await dest(target2)]);await distributeMalo(s.id,body,actor);await assert.rejects(()=>distributeMalo(s.id,body,actor));
 assert.equal(Number((await tx.lot.findUnique({where:{id:target.id}})).currentVolume),104);assert.equal(Number((await tx.lot.findUnique({where:{id:target2.id}})).currentVolume),52);assert.equal(Number((await tx.lot.findUnique({where:{id:s.pcm}})).currentVolume),20.25);
 assert.equal((await readMaloControl(tx,s.id,'PCM',actor)).criterionReached,true);
 await addMaloInputs(s.id,{snapshot:await s.snap(s.pcm),recipe:{sources:[],waterVolumeHl:.5,products:[]},performedAt:'2026-10-08T10:00:00Z',idempotencyKey:randomUUID()},actor);
 const invalid=await readMaloControl(tx,s.id,'PCM',actor);assert.equal(invalid.criterionReached,false);assert.equal(invalid.reason,'CONTROLE_PERIME');await assert.rejects(()=>request([body.destinations[0]]).then(x=>distributeMalo(s.id,x,actor)));
}));
test('retour partiel conserve le reliquat ; un transfert antérieur à sa source est refusé', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async f=>{
 const s=await setup(f),pcm=await f.tx.lot.findUnique({where:{id:s.pcm}});await f.tx.lotEvent.update({where:{id:pcm.maloCompositionEventId},data:{eventDatetime:new Date('2026-10-02T10:00:00Z')}});
 const body={direction:'PCM_TO_MR',source:await s.snap(s.pcm),target:await s.snap(s.mr),volumeHl:.5,confirmed:true,performedAt:'2026-10-02T09:00:00Z',idempotencyKey:randomUUID()};await assert.rejects(()=>transferMalo(s.id,body,f.actor));
 await transferMalo(s.id,{...body,performedAt:'2026-10-02T11:00:00Z',idempotencyKey:randomUUID()},f.actor);
 await transferMalo(s.id,{direction:'MR_TO_PCM',source:await s.snap(s.mr),target:await s.snap(s.pcm),volumeHl:1,confirmed:true,performedAt:'2026-10-02T12:00:00Z',idempotencyKey:randomUUID()},f.actor);
 const mr=await f.tx.lot.findUnique({where:{id:s.mr}});assert.equal(Number(mr.currentVolume),1);assert.equal(mr.status,'MR_TRANSFERE_PARTIELLEMENT');assert.equal(Number((await f.tx.lot.findUnique({where:{id:s.pcm}})).currentVolume),25.25);
}));
test('abandon conserve les reliquats, interdit les opérations ; terminé exige zéro', {skip:!process.env.MALO_TEST_DATABASE},()=>fixture(async f=>{
 const {closeMaloDossier}=require('../../server/modules/malo/malo-distribution.service.ts');const s=await setup(f);const body={snapshots:[await s.snap(s.mr),await s.snap(s.pcm)],status:'TERMINE',performedAt:'2026-10-03T08:00:00Z',idempotencyKey:randomUUID()};await assert.rejects(()=>closeMaloDossier(s.id,body,f.actor));await closeMaloDossier(s.id,{...body,status:'ABANDONNE',idempotencyKey:randomUUID()},f.actor);assert.equal(Number((await f.tx.lot.findUnique({where:{id:s.pcm}})).currentVolume),24.75);await assert.rejects(()=>s.transfer('MR_TO_PCM',s.mr,s.pcm,1));
}));
