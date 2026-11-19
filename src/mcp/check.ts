// The checks a Scenario plug-in's local MCP server passes: the rules
// scenario-mcp applies to its own tools. What Claude Code shows the model
// fits before its cut, every tool says what it returns and carries a title
// and all four hints, and a server with many tools lists a core and serves
// the rest through a catalog. A plug-in's tests write its server's tools as a
// snapshot, which the plug-in commits and checks:
//
//   components mcp-check <snapshot.json>
//
// The snapshot is {"instructions"?: string, "tools": [...]}: the initialize
// result's instructions and every tool as tools/list sends it. A tool served
// only through the catalog stays in the snapshot with scenario-mcp's marker,
// _meta {"scenario.com/listing": "catalog"}.

import fs from "node:fs";

/** Claude Code shows the model this many characters of each description and of the instructions. */
export const CUT = 2048;
/** Headroom under Codex's 5,000 B threshold, past which it drops every property description. */
export const MAX_INPUT_SCHEMA_BYTES = 4500;
export const MAX_PROPERTY_DESCRIPTION = 1024;
/** Tools listed besides the catalog's own; more go behind the catalog. */
export const MAX_LISTED = 30;
/** The Anthropic Directory's limit on tool names. */
export const MAX_NAME = 64;

const HINTS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
const LISTING = "scenario.com/listing";
// The catalog's tools, as scenario-mcp names them after its own prefix
// (scenario_tools_list, scenario_tool_execute_read, ...).
const CATALOG = { list: /^(\w+)_tools_list$/, search: /^(\w+)_tools_search$/ };
const LANE = /^(\w+)_tool_execute_(read|write|delete)$/;

export interface Tool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface Snapshot {
  instructions?: string;
  tools: Tool[];
}

export interface Problem {
  /** The tool at fault, or none for the server as a whole. */
  tool?: string;
  message: string;
}

export function catalogOnly(tool: Tool): boolean {
  return tool._meta?.[LISTING] === "catalog";
}

/** The execute lane that runs a catalog-only tool, from its hints. */
export function laneOf(tool: Tool): "read" | "write" | "delete" {
  if (tool.annotations?.readOnlyHint === true) return "read";
  return tool.annotations?.destructiveHint === true ? "delete" : "write";
}

/** Every description string anywhere in a JSON Schema, with its path. */
function schemaDescriptions(node: unknown, at: string, out: [string, string][] = []): [string, string][] {
  if (Array.isArray(node)) node.forEach((child, i) => schemaDescriptions(child, `${at}[${i}]`, out));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "description" && typeof value === "string") out.push([at, value]);
      else schemaDescriptions(value, `${at}.${key}`, out);
    }
  }
  return out;
}

function checkTool(tool: Tool, problems: Problem[]): void {
  const say = (message: string) => problems.push({ tool: tool.name, message });
  if (!/^[A-Za-z0-9_.-]+$/.test(tool.name) || tool.name.length > MAX_NAME) say(`the name must be 1 to ${MAX_NAME} letters, digits, _, - or .`);

  const title = tool.title ?? tool.annotations?.title;
  if (typeof title !== "string" || !title.trim()) say("no title: set title or annotations.title");
  for (const hint of HINTS) {
    if (typeof tool.annotations?.[hint] !== "boolean") say(`annotations.${hint} is not set: say true or false`);
  }
  if (tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint === true) say("read-only and destructive at once");

  const description = tool.description ?? "";
  if (!description.trim()) say("no description");
  else {
    if (description.length > CUT) say(`the description is ${description.length} characters; Claude Code drops everything past ${CUT}`);
    if (!description.includes("Returns:")) say("no Returns: line, the only output documentation Claude Code shows the model");
    if (/^\s*Args:/m.test(description)) say("an Args: block: describe each parameter in its inputSchema instead");
  }

  const schema = tool.inputSchema;
  if (!schema || schema.type !== "object") {
    say('inputSchema must be a JSON Schema of type "object"');
    return;
  }
  const bytes = Buffer.byteLength(JSON.stringify(schema), "utf8");
  if (bytes > MAX_INPUT_SCHEMA_BYTES) say(`inputSchema is ${bytes} B, over ${MAX_INPUT_SCHEMA_BYTES} B: Codex drops every property description past 5,000 B`);
  for (const [at, text] of schemaDescriptions(schema, "inputSchema")) {
    if (text.length > MAX_PROPERTY_DESCRIPTION) say(`${at}: the description is ${text.length} characters, over ${MAX_PROPERTY_DESCRIPTION}`);
  }
  const properties = (schema.properties ?? {}) as Record<string, { description?: unknown }>;
  for (const [name, property] of Object.entries(properties)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) say(`parameter ${name} is not snake_case`);
    if (typeof property?.description !== "string" || !property.description.trim()) say(`parameter ${name} has no description`);
  }
}

function checkListing(tools: Tool[], problems: Problem[]): void {
  const listed = tools.filter((t) => !catalogOnly(t));
  const hidden = tools.filter(catalogOnly);
  const prefixOf = (re: RegExp) => listed.map((t) => re.exec(t.name)?.[1]).find((p) => p !== undefined);
  const prefix = prefixOf(CATALOG.list) ?? prefixOf(CATALOG.search) ?? prefixOf(LANE);
  const lanes = new Set(listed.map((t) => LANE.exec(t.name)).filter((m) => m && m[1] === prefix).map((m) => m![2]));
  const gateway = listed.filter((t) => prefix !== undefined && (t.name.startsWith(`${prefix}_tools_`) || t.name.startsWith(`${prefix}_tool_execute_`)));
  const own = listed.length - gateway.length;

  if (own > MAX_LISTED) {
    problems.push({ message: `${own} tools listed: list at most ${MAX_LISTED} and serve the rest through the catalog (_tools_list, _tools_search, _tool_execute_<read|write|delete>, as scenario-mcp does), marked with _meta {"${LISTING}": "catalog"}` });
  }
  if (!hidden.length) return;
  const name = prefix ?? "<prefix>";
  for (const part of ["tools_list", "tools_search"]) {
    if (!listed.some((t) => t.name === `${name}_${part}`)) problems.push({ message: `${hidden.length} tools are catalog-only, but ${name}_${part} is not listed` });
  }
  for (const tool of hidden) {
    const lane = laneOf(tool);
    if (!lanes.has(lane)) problems.push({ tool: tool.name, message: `catalog-only and ${lane === "read" ? "read-only" : lane === "delete" ? "destructive" : "writes"}, but ${name}_tool_execute_${lane} is not listed` });
  }
}

/** Everything in a snapshot that breaks the rules; empty when it passes. */
export function check(snapshot: Snapshot): Problem[] {
  const problems: Problem[] = [];
  if (typeof snapshot.instructions === "string" && snapshot.instructions.length > CUT) {
    problems.push({ message: `the instructions are ${snapshot.instructions.length} characters; Claude Code drops everything past ${CUT}` });
  }
  const seen = new Set<string>();
  for (const tool of snapshot.tools) {
    if (seen.has(tool.name)) problems.push({ tool: tool.name, message: "listed twice" });
    seen.add(tool.name);
    checkTool(tool, problems);
  }
  checkListing(snapshot.tools, problems);
  return problems;
}

/** The sizes worth watching: tools, listed ones, and what tools/list sends. */
export function measure(snapshot: Snapshot): { tools: number; listed: number; bytes: number; longest: number } {
  const listed = snapshot.tools.filter((t) => !catalogOnly(t));
  return {
    tools: snapshot.tools.length,
    listed: listed.length,
    bytes: Buffer.byteLength(JSON.stringify({ tools: listed }), "utf8"),
    longest: Math.max(0, ...snapshot.tools.map((t) => (t.description ?? "").length)),
  };
}

export function read(file: string): Snapshot {
  const snapshot = JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot;
  if (!snapshot || !Array.isArray(snapshot.tools) || snapshot.tools.some((t) => typeof t?.name !== "string")) {
    throw new Error(`${file}: expected {"instructions"?: string, "tools": [{"name": ..., ...}]}, the server's tools as tools/list sends them`);
  }
  return snapshot;
}

export async function main(argv: string[]): Promise<number> {
  const file = argv[0];
  if (!file || argv.length > 1) {
    process.stderr.write("usage: components mcp-check <snapshot.json>\n");
    return 2;
  }
  const snapshot = read(file);
  const problems = check(snapshot);
  for (const p of problems) process.stdout.write(`${p.tool ? `${p.tool}: ` : ""}${p.message}\n`);
  const m = measure(snapshot);
  process.stdout.write(`${file}: ${m.tools} tool${m.tools === 1 ? "" : "s"}, ${m.listed} listed, tools/list ${m.bytes} B, longest description ${m.longest} characters; ${problems.length ? `${problems.length} problems` : "passes"}\n`);
  return problems.length ? 1 : 0;
}
