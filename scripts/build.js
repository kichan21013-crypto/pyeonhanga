import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import './build-core.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const headersPath = resolve(root, 'dist', '_headers');
const headers = await readFile(headersPath, 'utf8');
await writeFile(headersPath, headers.replace("img-src 'self' https:;", "img-src 'self' https: data:;").replace('  Referrer-Policy:', '  Cache-Control: no-cache, must-revalidate\n  Referrer-Policy:'));

// 모바일 클라이언트 캐시 버전. 기능 수정 배포 시 URL 자체를 바꿔 이전 JS 캐시와 섞이지 않게 합니다.
const CLIENT_VERSION = '20261125-v44';

// 홈 전용 앱형 UI 레이어. 기존 추천 엔진은 유지하고 홈 DOM만 재배치합니다.
const indexPath = resolve(root, 'dist', 'index.html');
const index = await readFile(indexPath, 'utf8');
const versionedIndex = index
  .replace('src="/app.js"', `src="/app.js?v=${CLIENT_VERSION}"`)
  .replace('</head>', `<link rel="stylesheet" href="/assets/v12-direct-home.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v13-companion.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v14-companion-first.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v15-party-program.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v16-together.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v18-premium.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v19-cohorts.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v20-interest-priority.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v21-popular-first.css?v=${CLIENT_VERSION}"><link rel="stylesheet" href="/assets/v22-public-programs.css?v=20261125-v46"></head>`)
  .replace('</body>', `<script type="module" src="/assets/v12-direct-home.js?v=20261125-v46"></script></body>`);
await writeFile(indexPath, versionedIndex);
