// components: the shared site tooling of the Scenario plug-ins.
//
//   components handbook [--config handbook.config.json] [--out <dir>] [--no-pdf] [--no-og] [--quiet]
//   components paths [--config handbook.config.json]
//   components og --title <title> [--subtitle <line>] [--image <file or address>] --out og.png
//   components mcp-check <snapshot.json>
//
// Run from the plug-in repository (or pass --config with its path). `paths`
// prints, one per line, the paths the handbook is built from, relative to
// where it runs. `mcp-check` checks a snapshot of a plug-in's local MCP
// server (src/mcp/check.ts).

import path from "node:path";

const USAGE = `usage: components handbook [--config handbook.config.json] [--out <dir>] [--no-pdf] [--no-og] [--quiet]
       components paths [--config handbook.config.json]
       components og --title <title> [--subtitle <line>] [--image <file or address>] --out og.png
       components mcp-check <snapshot.json>
`;

async function paths(argv: string[]): Promise<number> {
  const at = argv.indexOf("--config");
  const configPath = at >= 0 ? (argv[at + 1] ?? "") : "handbook.config.json";
  const { loadConfig, docPaths } = await import("./handbook/config.ts");
  const { root, config } = loadConfig(configPath);
  // Relative to where it runs (the repository root in the action), so git can restore them.
  const here = (p: string): string => path.relative(process.cwd(), path.join(root, p)).split(path.sep).join("/");
  const configFile = path.relative(root, path.resolve(configPath));
  process.stdout.write(docPaths(config, configFile).map(here).join("\n") + "\n");
  return 0;
}

const COMMANDS: Record<string, (argv: string[]) => Promise<number> | number> = {
  handbook: async (argv) => (await import("./handbook/build.ts")).main(argv),
  paths,
  og: async (argv) => (await import("./og/index.ts")).main(argv),
  "mcp-check": async (argv) => (await import("./mcp/check.ts")).main(argv),
};

/** Runs a command and returns its exit code. */
export async function run(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const handler = command ? COMMANDS[command] : undefined;
  if (!handler) {
    process.stderr.write(USAGE);
    return 2;
  }
  try {
    return await handler(rest);
  } catch (error) {
    process.stderr.write(`components ${command}: ${(error as Error).message}\n`);
    return 1;
  }
}
