#!/usr/bin/env node
// The command's entry: registers tsx, then runs the TypeScript CLI (src/cli.ts).
// It stays JavaScript because Node will not strip types from files under
// node_modules, where npx installs the package, and never compiles the JSX of
// the link-preview cards; tsx does both.
import { register } from "tsx/esm/api";

register();
const { run } = await import("../src/cli.ts");
process.exit(await run(process.argv.slice(2)));
