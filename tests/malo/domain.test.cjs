const test = require('node:test');
const assert = require('node:assert/strict');
const malo = require('../../lib/malo.ts');
const profiles = require('../../lib/malo-protocols.ts');
test('dose 4% par défaut sur le volume avant ajout', () => {
 assert.equal(malo.DEFAULT_MALO_DOSE_PCT, 4);
 assert.equal(malo.calculateMaloDose(100, 4), 4);
 assert.equal(malo.calculateMaloDose(100, 3.5), 3.5);
 for (const n of [0,-1,Infinity,NaN]) assert.throws(() => malo.calculateMaloDose(100,n));
});
test('critère exact des deux tiers et absence de référence', () => {
 assert.equal(malo.evaluateMaloControl(6,2,true).criterionReached,true);
 assert.equal(malo.evaluateMaloControl(6,2,true).consumptionPct.toFixed(1),'66.7');
 assert.equal(malo.evaluateMaloControl(6,2.0000001,true).criterionReached,false);
 assert.equal(malo.evaluateMaloControl(6,0,true).criterionReached,true);
 for (const n of [null,0,-1,NaN]) assert.equal(malo.evaluateMaloControl(n,2,true).reason,'REFERENCE_MANQUANTE');
 assert.equal(malo.evaluateMaloControl(6,2,false).reason,'CONTROLE_PERIME');
 assert.ok(malo.evaluateMaloControl(6,7,true).consumptionPct < 0);
});
test('profils distincts et calendrier en jours civils', () => {
 const a=profiles.getMaloProtocol('PROGRESSIVE'), b=profiles.getMaloProtocol('CO_INOCULATION');
 assert.equal(a.mrMalicThreshold,1);
 assert.equal(b.mrMalicThreshold,null);
 assert.equal(a.recipientFirstControlDays,21);
 assert.equal(b.recipientFirstControlDays,15);
 const rows=profiles.buildMaloSchedule(b,{startedAt:'2026-10-23',pcmInoculatedAt:'2026-10-23',distributedAt:'2026-10-23'});
 assert.ok(rows.some(r => r.date==='2026-10-26'));
 assert.ok(rows.some(r => r.date==='2026-11-07'));
 assert.equal(profiles.getMaloProtocol('CUSTOM').mrMalicThreshold,null);
});
test('préparations et sous-produits exclus des sources ordinaires',()=>{
 for(const l of [{status:'VIN_DE_BASE',maloRole:'MR'}, {status:'VIN_DE_BASE',qualiteLot:'LEVAIN'},{status:'LIES'},{status:'ACTIF',qualiteLot:null,currentContainer:{displayName:'Cuve Levain'}}]) assert.equal(malo.isMaloSourceEligible({...l,currentVolume:10}),false);
 assert.equal(malo.isMaloSourceEligible({status:'MOUT_DEBOURBE',currentVolume:10}),true);
 assert.throws(()=>malo.assertMaloGenericMutationAllowed({maloRole:'PCM'},'volume'));
});
