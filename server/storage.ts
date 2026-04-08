/**
 * Re-export shim — all implementation lives in server/storage/ domain modules.
 * This file exists so that `import { storage } from "./storage.js"` continues
 * to resolve (Node resolves a file before a directory's index.ts).
 */
export { storage } from "./storage/index.js";
export type { IStorage } from "./storage/index.js";
