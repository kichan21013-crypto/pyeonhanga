import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import './build-core.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const headersPath = resolve(root, 'dist', '_headers');
const headers = await readFile(headersPath, 'utf8');
await writeFile(headersPath, headers.replace("img-src 'self' https:;", "img-src 'self' https: data:;"));
