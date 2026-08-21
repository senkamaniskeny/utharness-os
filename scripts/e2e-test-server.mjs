import { buildApp } from "../apps/backend/dist/src/server.js";
import { GenericCliAdapter } from "../apps/backend/dist/src/agents.js";

const port = Number(process.env.UTHARNESS_PORT ?? 4527);
const host = process.env.UTHARNESS_HOST ?? "127.0.0.1";
const context = await buildApp({ dbFile: process.env.UTHARNESS_DB ?? "/tmp/utharness-e2e.sqlite", logger: true });
for (const [id, name] of [["fixture-architect", "Fixture Architect"], ["fixture-implementer", "Fixture Implementer"], ["fixture-reviewer", "Fixture Reviewer"]]) {
  context.registry.register(new GenericCliAdapter(id, name, "/bin/cat"));
}
await context.app.listen({ host, port });
console.log(`E2E backend listening at http://${host}:${port}`);
