// 구로통합도서관(lib.guro.go.kr) 소장·대출 상태 조회 로직
// 브라우저 콘솔과 Node(GitHub Actions) 양쪽에서 같은 코드를 쓴다.

export const HOME_ID = 59; // 고척열린도서관
export const HOME_NAME = '고척열린도서관';

// 상호대차 대상에서 빼는 분관: 학교 도서관, 무인 스마트도서관(키오스크), 행정자료실 등
const NO_CR = /고도서관$|스마트도서관|행정자료실|서울시민카드|선예약기/;

export const norm = t => String(t || '').replace(/[\s,.:·!?\-~∼"'()［］\[\]「」『』<>《》]/g, '').toLowerCase();

// 도서관 서명 앞의 "[만화] ", "(미야자키 하야오)" 같은 머리말 제거
const stripPrefix = s => String(s || '').replace(/^\s*(\[[^\]]*\]|\([^)]*\))\s*/g, '').replace(/^\s*(\[[^\]]*\]|\([^)]*\))\s*/g, '');

// "창의성을 지휘하라(확장판)" → "창의성을 지휘하라", "왕도의 개 1" → "왕도의 개"
export function baseTitle(t) {
  return String(t || '')
    .replace(/\(.*?\)/g, ' ')
    .split(/[:：]/)[0]
    .replace(/\s+\d+\s*$/, '')
    .trim();
}

const mainTitle = s => String(s || '').split(/[:：]/)[0];

export async function checkTitle(title, fetchFn = fetch, origin = 'https://lib.guro.go.kr') {
  const base = baseTitle(title);
  const q = base.replace(/[,·]/g, ' ').replace(/\s+/g, ' ').trim();
  const url = `${origin}/pyxis-api/1/collections/1/search?max=40&all=${encodeURIComponent('l|a|' + q)}`;
  const res = await fetchFn(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
  const json = await res.json();
  const nb = norm(base);
  const nf = norm(String(title).replace(/\(.*?\)/g, ' '));
  const list = (json.data && json.data.list) || [];
  // 1순위: 권수·부제까지 전체 서명이 맞는 것, 없으면 본서명이 맞는 것
  const exact = list.filter(b => norm(stripPrefix(b.titleStatement)).startsWith(nf));
  const hits = exact.length ? exact : list.filter(b => {
    const m = norm(mainTitle(stripPrefix(b.titleStatement)));
    return m === nb || (nb.length >= 2 && m.startsWith(nb));
  });
  const vols = hits.flatMap(b => b.branchVolumes || []).filter(v => v.hasItem !== false);
  const home = vols.filter(v => v.id === HOME_ID);
  const others = vols.filter(v => v.id !== HOME_ID && !NO_CR.test(v.name));
  const ready = v => v.cStateCode === 'READY';

  let s, b = '';
  if (home.some(ready)) { s = 'ready'; b = HOME_NAME; }
  else if (others.some(ready)) { s = 'cr'; b = others.find(ready).name; }
  else if (home.length) { s = 'loan'; b = HOME_NAME; }
  else if (others.length) { s = 'loan'; b = others[0].name; }
  else { s = 'none'; }
  return { s, b };
}
