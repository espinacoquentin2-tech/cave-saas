import { handleMalo } from "@/server/modules/malo/malo.http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return handleMalo(request, "read", Number((await params).id));
}
export async function PATCH(request: Request, { params }: Context) {
  return handleMalo(request, "update", Number((await params).id));
}
