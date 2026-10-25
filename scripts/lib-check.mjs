// 책 목록을 모아 구로통합도서관에 조회하고 lib.json을 갱신한다.
// 실행: node scripts/lib-check.mjs   (GitHub Actions에서 몇 시간마다 돈다)
//
// 조회 대상 = adds/*.json 의 책 + index.html의 KNOWN_COVERS·추천 시드 + lib-titles.txt(한 줄에 한 권)
// 앱에서 직접 추가한 책은 여기 목록에 없으면 "도서관 검색" 링크만 보인다 → lib-titles.txt에 제목을 추가하면 된다.

import fs from 'node:fs';
import { checkTitle, HOME_NAME } from './lib-core.mjs';

const libKey = t => String(t || '').replace(/[\s,.:·!?\-~∼"'()［］\[\]「」『』<>《》]/g, '').toLowerCase();

function collectTitles() {
  const set = new Set();
  if (fs.existsSync('adds')) {
    for (const f of fs.readdirSync('adds').filter(f => f.endsWith('.json'))) {
      try { for (const x of JSON.parse(fs.readFileSync(`adds/${f}`, 'utf8'))) if (x.t) set.add(x.t); } catch (e) { console.warn('skip', f, e.message); }
    }
  }
  const html = fs.readFileSync('index.html', 'utf8');
  const kc = html.match(/const KNOWN_COVERS = \{([\s\S]*?)\};/);
  if (kc) for (const m of kc[1].matchAll(/'([^']+)':/g)) set.add(m[1]);
  const w = html.match(/const W = \[([\s\S]*?)\];/);
  if (w) for (const m of w[1].matchAll(/\['([^']+)'/g)) set.add(m[1]);
  if (fs.existsSync('lib-titles.txt')) {
    for (const line of fs.readFileSync('lib-titles.txt', 'utf8').split('\n')) {
      const t = line.trim(); if (t && !t.startsWith('#')) set.add(t);
    }
  }
  return [...set];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const titles = collectTitles();
const books = {};
let ok = 0, fail = 0;
for (const t of titles) {
  try {
    books[libKey(t.replace(/\(.*?\)/g, ' '))] = await checkTitle(t);
    ok++;
  } catch (e) {
    fail++; console.warn('fail', t, e.message);
  }
  await sleep(400);
}
console.log(`checked ${ok}, failed ${fail}`);
if (!ok) { console.error('도서관에 한 건도 접속하지 못했어요. lib.json을 그대로 둡니다.'); process.exit(1); }

// 상태가 바뀌었을 때만 파일을 고쳐서 커밋이 쌓이지 않게 한다
let prev = {};
try { prev = JSON.parse(fs.readFileSync('lib.json', 'utf8')).books || {}; } catch (_) {}
if (JSON.stringify(prev) === JSON.stringify(books)) { console.log('변동 없음'); process.exit(0); }
const now = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
fs.writeFileSync('lib.json', JSON.stringify({ updated: now, home: HOME_NAME, books }, null, 1) + '\n');
console.log('lib.json 갱신', now);
