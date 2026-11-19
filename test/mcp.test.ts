// mcp-check: a plug-in's local MCP server against scenario-mcp's rules.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { check, measure, CUT, MAX_INPUT_SCHEMA_BYTES, MAX_LISTED, type Snapshot, type Tool } from "../src/mcp/check.ts";

const FIXTURES = path.join(import.meta.dirname, "fixtures", "mcp");
const CLI = path.join(import.meta.dirname, "..", "bin", "components.mjs");

function server(): Snapshot {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, "server.json"), "utf8"));
}

function messages(snapshot: Snapshot): string[] {
  return check(snapshot).map((p) => `${p.tool ?? ""}: ${p.message}`);
}

/** The fixture with one tool changed. */
function changed(name: string, change: (tool: Tool) => void): Snapshot {
  const snapshot = server();
  change(snapshot.tools.find((t) => t.name === name)!);
  return snapshot;
}

test("a server that keeps every rule passes", () => {
  assert.deepEqual(check(server()), []);
  assert.deepEqual(measure(server()), { tools: 10, listed: 7, bytes: measure(server()).bytes, longest: 212 });
});

test("each tool has a title and all four hints", () => {
  const found = messages(changed("demo_generate", (t) => {
    delete t.title;
    delete t.annotations!.openWorldHint;
  }));
  assert.deepEqual(found, ["demo_generate: no title: set title or annotations.title", "demo_generate: annotations.openWorldHint is not set: say true or false"]);
  assert.deepEqual(check(changed("demo_generate", (t) => {
    delete t.title;
    t.annotations!.title = "Generate";
  })), [], "annotations.title counts");
  assert.match(messages(changed("demo_status", (t) => (t.annotations!.destructiveHint = true))).join("\n"), /read-only and destructive at once/);
});

test("descriptions fit Claude Code's cut, say what they return, and leave parameters to the schema", () => {
  const long = messages(changed("demo_status", (t) => (t.description = `${"x".repeat(CUT)}\nReturns: y`)));
  assert.match(long.join("\n"), new RegExp(`demo_status: the description is ${CUT + 11} characters`));
  assert.match(messages(changed("demo_status", (t) => (t.description = "Who is signed in."))).join("\n"), /demo_status: no Returns: line/);
  assert.match(messages(changed("demo_status", (t) => (t.description += "\nArgs:\n  model_id: the model"))).join("\n"), /an Args: block/);
  assert.match(messages(changed("demo_status", (t) => (t.description = " "))).join("\n"), /demo_status: no description/);
});

test("server instructions fit the cut too", () => {
  const snapshot = server();
  snapshot.instructions = "x".repeat(CUT + 1);
  assert.deepEqual(messages(snapshot), [`: the instructions are ${CUT + 1} characters; Claude Code drops everything past ${CUT}`]);
});

test("input schemas stay small, every parameter is snake_case and described", () => {
  const big = messages(changed("demo_generate", (t) => ((t.inputSchema!.properties as Record<string, unknown>).prompt = { type: "string", description: "x".repeat(MAX_INPUT_SCHEMA_BYTES) })));
  assert.match(big.join("\n"), /inputSchema is \d+ B, over 4500 B/);
  assert.match(big.join("\n"), /inputSchema\.properties\.prompt: the description is 4500 characters, over 1024/);
  const params = messages(changed("demo_generate", (t) => ((t.inputSchema!.properties as Record<string, unknown>).modelId = { type: "string" })));
  assert.deepEqual(params, ["demo_generate: parameter modelId is not snake_case", "demo_generate: parameter modelId has no description"]);
  assert.match(messages(changed("demo_generate", (t) => (t.inputSchema = { type: "string" }))).join("\n"), /must be a JSON Schema of type "object"/);
});

test("names are short and unique", () => {
  assert.match(messages(changed("demo_status", (t) => (t.name = "x".repeat(65)))).join("\n"), /must be 1 to 64/);
  const twice = server();
  twice.tools.push(twice.tools[0]!);
  assert.match(messages(twice).join("\n"), /demo_status: listed twice/);
});

test("more than 30 listed tools go behind the catalog", () => {
  const snapshot = server();
  const extra = (i: number): Tool => ({ ...snapshot.tools[0]!, name: `demo_extra_${i}` });
  snapshot.tools.push(...Array.from({ length: MAX_LISTED - 2 }, (_, i) => extra(i)));
  assert.deepEqual(check(snapshot), [], "30 of the server's own, plus the catalog's");
  snapshot.tools.push(extra(MAX_LISTED));
  assert.match(messages(snapshot).join("\n"), /^: 31 tools listed: list at most 30/m);
  snapshot.tools.at(-1)!._meta = { "scenario.com/listing": "catalog" };
  assert.deepEqual(check(snapshot), [], "a catalog-only tool does not count");
});

test("catalog-only tools need the catalog listed, and the lane their hints call for", () => {
  const withoutSearch = server();
  withoutSearch.tools = withoutSearch.tools.filter((t) => t.name !== "demo_tools_search");
  assert.deepEqual(messages(withoutSearch), [": 3 tools are catalog-only, but demo_tools_search is not listed"]);
  const withoutDelete = server();
  withoutDelete.tools = withoutDelete.tools.filter((t) => t.name !== "demo_tool_execute_delete");
  assert.deepEqual(messages(withoutDelete), ["demo_object_delete: catalog-only and destructive, but demo_tool_execute_delete is not listed"]);
});

test("the command prints the problems and the sizes, and fails on a problem", () => {
  const run = (file: string) => spawnSync(process.execPath, [CLI, "mcp-check", file], { encoding: "utf8" });
  const ok = run(path.join(FIXTURES, "server.json"));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /server\.json: 10 tools, 7 listed, tools\/list \d+ B, longest description 212 characters; passes\n$/);
  const broken = run(path.join(FIXTURES, "broken.json"));
  assert.equal(broken.status, 1);
  assert.match(broken.stdout, /^demo_generate: no title/m);
  assert.match(broken.stdout, /broken\.json: 1 tool, 1 listed, .*; 8 problems\n$/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "components-mcp-"));
  fs.writeFileSync(path.join(dir, "list.json"), JSON.stringify([{ name: "x" }]));
  const shape = run(path.join(dir, "list.json"));
  assert.equal(shape.status, 1);
  assert.match(shape.stderr, /expected \{"instructions"\?: string, "tools": /);
  assert.equal(spawnSync(process.execPath, [CLI, "mcp-check"], { encoding: "utf8" }).status, 2);
});
