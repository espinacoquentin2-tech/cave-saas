const {randomUUID}=require('node:crypto');
const {createMaloDossier}=require('../../server/modules/malo/malo-dossier.service.ts');const {prepareMaloLot}=require('../../server/modules/malo/malo-preparation.service.ts');const {transferMalo}=require('../../server/modules/malo/malo-transfer.service.ts');const {distributeMalo}=require('../../server/modules/malo/malo-distribution.service.ts');const {confirmMaloHomogenization,setMaloInitialReference}=require('../../server/modules/malo/malo-control.service.ts');const {readLot,snapshotOf}=require('../../server/modules/malo/malo-operation.ts');
const at='2026-10-01T08:00:00Z';
async function setup({tx,actor,tank,wine}){
 const {preparationId:id}=await createMaloDossier({name:'Cycle',year:2026,plannedVolumeHl:100,profile:'CO_INOCULATION',idempotencyKey:randomUUID()},actor);const source=await wine('Source',100);
 const prepare=async(role,volume)=>{const c=await tank(role,50);const v=Number((await tx.lot.findUnique({where:{id:source.id}})).currentVolume);await prepareMaloLot(id,{role,name:role,destinationContainerId:c.id,recipe:{sources:[{lotId:source.id,volumeHl:volume,expectedVolumeHl:v}],waterVolumeHl:0,products:[]},performedAt:at,idempotencyKey:randomUUID()},actor);return (await tx.lot.findFirst({where:{maloPreparationId:id,maloRole:role}})).id};
 const mr=await prepare('MR',1.5),pcm=await prepare('PCM',24.75);const snap=async lotId=>snapshotOf(tx,await readLot(tx,lotId,actor),actor);
 const transfer=async(direction,source,target,volumeHl)=>transferMalo(id,{direction,source:await snap(source),target:await snap(target),volumeHl,confirmed:true,performedAt:'2026-10-02T08:00:00Z',idempotencyKey:randomUUID()},actor);
 return {id,mr,pcm,snap,transfer};
}
module.exports={setup};
