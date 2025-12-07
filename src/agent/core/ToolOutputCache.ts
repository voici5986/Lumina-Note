/**
 * Tool output cache for keeping full results out of the chat context.
 * Stores in-memory only (not persisted) to avoid bloating localStorage.
 */

interface CachedOutput {
  id: string;
  tool: string;
  content: string;
  createdAt: number;
  paramsSignature?: string;
}

const toolOutputCache = new Map<string, CachedOutput>();

/**
 * Cache full tool output and return its id.
 */
export function cacheToolOutput(
  tool: string,
  content: string,
  paramsSignature?: string
): string {
  const id = `${tool}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  toolOutputCache.set(id, {
    id,
    tool,
    content,
    createdAt: Date.now(),
    paramsSignature,
  });

  return id;
}

/**
 * Retrieve cached output by id.
 */
export function getCachedToolOutput(id: string): CachedOutput | undefined {
  return toolOutputCache.get(id);
}

/**
 * Clear all cached outputs (not used yet, but handy for future cleanup hooks).
 */
export function clearToolOutputCache(): void {
  toolOutputCache.clear();
}
