import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import './build-core.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const headersPath = resolve(root, 'dist', '_headers');
const headers = await readFile(headersPath, 'utf8');
await writeFile(headersPath, headers.replace("img-src 'self' https:;", "img-src 'self' https: data:;"));

// 홈 전용 앱형 UI 레이어. 기존 추천 엔진은 유지하고 홈 DOM만 재배치합니다.
const indexPath = resolve(root, 'dist', 'index.html');
const index = await readFile(indexPath, 'utf8');
await writeFile(indexPath, index.replace('</body>', '<script type="module" src="/assets/v5-app-home.js"></script></body>'));
