import { handleMalo } from "@/server/modules/malo/malo.http";
export const GET = (request: Request) => handleMalo(request, "list");
export const POST = (request: Request) => handleMalo(request, "create");
