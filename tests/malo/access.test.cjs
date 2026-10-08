const test=require('node:test');const assert=require('node:assert/strict');const {handleMalo}=require('../../server/modules/malo/malo.http.ts');
test('API Malo exige une session',async()=>{
 const r=await handleMalo(new Request('http://localhost/api/malo'),'list');assert.equal(r.status,401);
});
const context=require('../../server/shared/request-context.ts');
test('écriture en lecture seule et identifiants invalides refusés',async()=>{
 const original=context.resolveAuthenticatedActor;try{
 context.resolveAuthenticatedActor=async()=>({userId:1,email:'test@example.test',role:'LECTURE_SEULE',roleKey:'LECTURE_SEULE',organizationId:1});
 const write=await handleMalo(new Request('http://localhost/api/malo',{method:'POST',body:'{}'}),'create');assert.equal(write.status,403);
 context.resolveAuthenticatedActor=async()=>({userId:1,email:'test@example.test',role:'ADMIN',roleKey:'ADMIN',organizationId:1});
 const invalid=await handleMalo(new Request('http://localhost/api/malo/x'),'read',NaN);assert.equal(invalid.status,400);
 const malformed=await handleMalo(new Request('http://localhost/api/malo',{method:'POST',body:'{}'}),'create');assert.equal(malformed.status,400);
 }finally{context.resolveAuthenticatedActor=original}
});
