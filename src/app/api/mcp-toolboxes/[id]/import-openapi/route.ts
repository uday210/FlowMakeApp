import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Sanitize an OpenAPI path + method into a valid MCP tool name.
// e.g. "get" + "/pets/{petId}" → "get_pets_petid"
function sanitizeName(method: string, path: string): string {
  return (method.toLowerCase() + "_" + path)
    .toLowerCase()
    .replace(/[{}]/g, "")   // remove braces from path params
    .replace(/[^a-z0-9]+/g, "_") // non-alnum → underscore
    .replace(/^_+|_+$/g, "");    // trim leading/trailing underscores
}

// Extract JSON Schema properties from an OpenAPI parameter list.
function paramsToProperties(
  parameters: Array<{ name: string; in: string; description?: string; schema?: { type?: string }; type?: string }>
): Record<string, { type: string; description?: string }> {
  const props: Record<string, { type: string; description?: string }> = {};
  for (const p of parameters) {
    if (!p.name) continue;
    const type = p.schema?.type ?? p.type ?? "string"; // Swagger 2 has .type directly
    props[p.name] = { type };
    if (p.description) props[p.name].description = p.description;
  }
  return props;
}

// POST /api/mcp-toolboxes/[id]/import-openapi
// Body: { spec: string } — JSON string of an OpenAPI 3.x or Swagger 2.x spec
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Verify server belongs to org
  const { data: server } = await ctx.admin
    .from("mcp_toolboxes")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const body = await req.json();
  const { spec: specRaw } = body;
  if (!specRaw) return NextResponse.json({ error: "spec required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let spec: any;
  try {
    spec = typeof specRaw === "string" ? JSON.parse(specRaw) : specRaw;
  } catch {
    return NextResponse.json({ error: "spec is not valid JSON" }, { status: 400 });
  }

  const paths: Record<string, Record<string, unknown>> = spec.paths ?? {};
  const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolsToInsert: any[] = [];
  const toolNames: string[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const method of HTTP_METHODS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const operation = (pathItem as any)[method] as any;
      if (!operation || typeof operation !== "object") continue;

      const operationId: string | undefined = operation.operationId;
      const summary: string | undefined = operation.summary;
      const description: string | undefined = operation.description ?? summary;

      // Skip unnamed operations
      if (!operationId && !summary) continue;

      const name = sanitizeName(method, path);
      const display_name: string = operationId ?? summary ?? `${method.toUpperCase()} ${path}`;

      // Build input_schema from parameters + requestBody (OpenAPI 3) or body param (Swagger 2)
      const parameters: Array<{
        name: string;
        in: string;
        description?: string;
        schema?: { type?: string };
        type?: string;
      }> = Array.isArray(operation.parameters) ? operation.parameters : [];

      // Filter out body parameters from the flat list (Swagger 2 style) — handle separately
      const nonBodyParams = parameters.filter((p) => p.in !== "body");
      const properties: Record<string, { type: string; description?: string }> =
        paramsToProperties(nonBodyParams);

      // OpenAPI 3.x requestBody
      if (operation.requestBody) {
        const content = operation.requestBody.content ?? {};
        const jsonContent = content["application/json"];
        if (jsonContent?.schema?.properties) {
          for (const [propName, propSchema] of Object.entries(
            jsonContent.schema.properties as Record<string, { type?: string; description?: string }>
          )) {
            properties[propName] = {
              type: propSchema.type ?? "string",
              ...(propSchema.description ? { description: propSchema.description } : {}),
            };
          }
        }
      }

      // Swagger 2.x body parameter
      const bodyParam = parameters.find((p) => p.in === "body");
      if (bodyParam) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodySchema = (bodyParam as any).schema;
        if (bodySchema?.properties) {
          for (const [propName, propSchema] of Object.entries(
            bodySchema.properties as Record<string, { type?: string; description?: string }>
          )) {
            properties[propName] = {
              type: propSchema.type ?? "string",
              ...(propSchema.description ? { description: propSchema.description } : {}),
            };
          }
        }
      }

      toolsToInsert.push({
        org_id: ctx.orgId,
        server_id: id,
        name,
        display_name,
        description: description ?? null,
        input_schema: { type: "object", properties },
        enabled: true,
      });
      toolNames.push(name);
    }
  }

  if (toolsToInsert.length === 0) {
    return NextResponse.json({ imported: 0, tools: [] });
  }

  const { error } = await ctx.admin.from("mcp_tools").insert(toolsToInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: toolsToInsert.length, tools: toolNames }, { status: 201 });
}
