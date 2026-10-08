const test=require('node:test');const assert=require('node:assert/strict');
const {assertGenericLotMutationAllowed}=require('../../lib/levain.ts');
test('le parcours générique ne peut modifier une préparation Malo',()=>{
 for(const operation of ['status','volume','intrants'])assert.throws(()=>assertGenericLotMutationAllowed({status:'PCM_EN_DEVELOPPEMENT',qualiteLot:null,maloRole:'PCM'},operation),e=>e.statusCode===409);
 assert.doesNotThrow(()=>assertGenericLotMutationAllowed({status:'VIN_DE_BASE',qualiteLot:null},'volume'));
});
