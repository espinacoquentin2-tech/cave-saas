import { handleMixtion } from "@/server/modules/tirage/mixtion.http";
export const POST = (request: Request) => handleMixtion(request, "create");
