import { handleMalo } from "@/server/modules/malo/malo.http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleMalo(request, "close", Number((await params).id));
}
