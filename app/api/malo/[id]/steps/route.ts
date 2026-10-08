import { handleMalo } from "@/server/modules/malo/malo.http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleMalo(request, "steps", Number((await params).id));
}
