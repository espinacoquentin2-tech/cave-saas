import { handleLevainOperation } from '@/server/modules/levains/levain.http';
export const POST = (request: Request) => handleLevainOperation(request, 'feed');
