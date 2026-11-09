import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const exportDirectory = path.join(root, "out");
const publicDirectory = path.join(root, "dist", "public");

await rm(publicDirectory, { recursive: true, force: true });
await mkdir(path.dirname(publicDirectory), { recursive: true });
await cp(exportDirectory, publicDirectory, { recursive: true });
