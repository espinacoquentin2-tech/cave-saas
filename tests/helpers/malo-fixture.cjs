const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
// SQL tests refuse the configured remote DB. Supply this local URL explicitly.
if(process.env.MALO_TEST_DATABASE && !/^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL||'')) throw new Error('Malo SQL tests require an explicit local DATABASE_URL');
const {prisma}=require('../../server/shared/prisma.ts');const {MaloRepository}=require('../../server/modules/malo/malo.repository.ts');
async function fixture(work){
 const rollback=new Error('ROLLBACK_MALO_FIXTURE');const original=MaloRepository.withTransaction;let organizationId;
 try { await prisma.$transaction(async tx=>{
  const suffix=randomUUID();const org=await tx.organization.create({data:{name:'Test Malo',slug:`malo-${suffix}`}});organizationId=org.id;
  const user=await tx.user.create({data:{name:'Malo',email:`malo-${suffix}@example.test`,role:'Admin',roleKey:'ADMIN'}});
  const actor={userId:user.id,email:user.email,role:'ADMIN',roleKey:'ADMIN',organizationId:org.id,organizationSlug:org.slug,organizationName:org.name};
  const tank=async(name,capacity=200,status='VIDE')=>tx.container.create({data:{organizationId:org.id,code:`${name}-${randomUUID()}`,displayName:name,type:'CUVE_INOX',capacityValue:capacity,status}});
  const wine=async(name,volume=100,capacity=200)=>{const c=await tank(name,capacity,'PLEIN');return tx.lot.create({data:{organizationId:org.id,technicalCode:randomUUID(),businessCode:`${name}-${randomUUID()}`,year:2026,mainGrapeCode:'CH',sequenceNumber:1,status:'MOUT_DEBOURBE',currentVolume:volume,currentContainerId:c.id,qualiteLot:'Taille'}})};
  MaloRepository.withTransaction=async op=>{await tx.$executeRawUnsafe('SAVEPOINT malo_operation');try{const result=await op(tx);await tx.$executeRawUnsafe('RELEASE SAVEPOINT malo_operation');return result}catch(e){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT malo_operation');await tx.$executeRawUnsafe('RELEASE SAVEPOINT malo_operation');throw e}};
  await work({tx,actor,tank,wine});throw rollback;
 },{isolationLevel:'Serializable',timeout:60000}); }catch(e){if(e!==rollback)throw e}finally{MaloRepository.withTransaction=original}
 assert.equal(await prisma.organization.count({where:{id:organizationId}}),0);
}
module.exports={fixture,prisma};
