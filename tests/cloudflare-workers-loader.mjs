const NODE_TEST_STUB = "data:text/javascript,export {}";

/**
 * The production Worker bundle may import the runtime-provided `cloudflare:workers` module.
 * Stock Node does not implement that protocol, so the built-server contract harness resolves
 * exactly that one runtime module to an empty namespace. Every other specifier continues through
 * Node's normal resolver and therefore fails rather than being silently approximated.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { url: NODE_TEST_STUB, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
