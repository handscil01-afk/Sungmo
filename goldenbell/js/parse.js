'use strict';
/* ===================== 문제 붙여넣기 읽기 =====================
   <홍길동 출제> 줄 → 출제자 / 맨 끝 1. 2. 3. 4. 줄 → 객관식 보기 / '정답:' 줄 → 정답(뒤에 붙은 글은 해설)
   '맞으면 O, 틀리면 X' → OX 문제 (문장에서는 지움) / 빈 줄 → 문제 사이 구분 */
function parseQuestions(raw){
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n');
  const AUTH1 = /^[<\[〈《【(（]\s*(.+?)\s*(?:선생님\s*)?출제(?:자)?\s*[>\]〉》】)）]$/;
  const AUTH2 = /^출제(?:자)?\s*[:：]\s*(.+)$/;
  const ANS = /^정답\s*(?:은|는)?\s*(?:[:：]\s*(.*)|\s([OoXx○×①-⑨1-9].*))$/;
  // 구분 줄: <연습> <1부> <이벤트> <2부> <결승> — 그 아래 문제들의 구분·부를 정함
  const SEC = /^[<\[〈《【(（]\s*(연습(?:\s*(?:게임|문제))?|1\s*부|2\s*부|이벤트(?:\s*퀴즈)?|결승(?:\s*문제)?|동점(?:자)?(?:\s*문제)?)\s*[>\]〉》】)）]$/;
  const out = []; let author = '', kind = 'main', part = '1'; let cur = null;
  const flush = () => { if(cur){ const q = finishQ(cur); if(q) out.push(q); } cur = null; };
  for(const line of lines){
    const t = line.trim(); let m;
    if((m = t.match(SEC))){
      flush(); const w = m[1].replace(/\s/g, '');
      if(/^연습/.test(w)) kind = 'practice';
      else if(/^이벤트/.test(w)) kind = 'event';
      else if(/^(결승|동점)/.test(w)) kind = 'final';
      else { kind = 'main'; part = w[0]; }
      continue;
    }
    if((m = t.match(AUTH1)) || (m = t.match(AUTH2))){ flush(); author = m[1].trim(); continue; }
    if(!t){ flush(); continue; }
    if((m = t.match(ANS))){
      const a = (m[1] ?? m[2] ?? '').trim();
      if(cur) cur.ans.push(a);
      else if(out.length && !out[out.length - 1]._hasAns){ cur = out.pop()._src; cur.ans.push(a); }
      continue;
    }
    if(cur && cur.ans.length) flush();
    if(!cur) cur = { author, kind, part, lines:[], ans:[] };
    cur.lines.push(t);
  }
  flush();
  return out.map(q => { delete q._src; delete q._hasAns; return q; });
}
function finishQ(c){
  const L = c.lines.slice();
  const CH = /^(?:([1-9])\s*[.)．、,]|([①-⑨]))\s*(.+)$/;
  let k = L.length; const ch = [];
  while(k > 0){ const m = L[k - 1].match(CH); if(!m) break; ch.unshift({ n:m[1] ? +m[1] : '①②③④⑤⑥⑦⑧⑨'.indexOf(m[2]) + 1, t:m[3].trim() }); k--; }
  let choices = [], qEnd = L.length;
  for(let s = 0; s < ch.length; s++){ const sub = ch.slice(s); if(sub.length >= 2 && sub.every((x, i) => x.n === i + 1)){ choices = sub.map(x => x.t.replace(/[.。]\s*$/, '').trim()); qEnd = k + s; break; } }
  let text = L.slice(0, qEnd).join(' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/^\d{1,3}\s*[.)．]\s*(?=\S|$)/, '');
  if(((text.match(/"/g) || []).length) % 2) text = text.replace(/"/g, '');
  const OXRE = /\s*맞으면\s*[OoＯ○]\s*[,，]?\s*틀리면\s*[XxＸ×]\s*[.。]?\s*["”]?/g;
  const isOX = OXRE.test(text); text = text.replace(OXRE, ' ').replace(/\s+/g, ' ').trim();
  if(!text) return null;
  const ansRaw = c.ans.join(' ').replace(/\s+/g, ' ').trim();
  const type = choices.length ? 'choice' : (isOX || /^[OoXx○×Ｏ](?![A-Za-z])/.test(ansRaw)) ? 'ox' : 'short';
  let answer = '', expl = '', memo = '';
  if(type === 'ox'){
    const m = ansRaw.match(/^([OoＯ○]|[XxＸ×])(?![A-Za-z])\s*[.。,]?\s*(.*)$/);
    if(m){ answer = /[OoＯ○]/.test(m[1]) ? 'O' : 'X'; expl = m[2].trim(); } else if(ansRaw) memo = '원문 정답: ' + ansRaw;
  }else if(type === 'choice'){
    const m = ansRaw.match(/^([1-9]|[①-⑨])\s*번?(?![0-9])\s*[.。,)]?\s*(.*)$/);
    if(m){ const n = /[1-9]/.test(m[1]) ? +m[1] : '①②③④⑤⑥⑦⑧⑨'.indexOf(m[1]) + 1; if(n <= choices.length){ answer = String(n); expl = m[2].trim(); } else memo = '원문 정답: ' + ansRaw + ' (확인 필요)'; }
    else if(ansRaw) memo = '원문 정답: ' + ansRaw + ' (보기 번호가 아니라 확인 필요)';
  }else answer = ansRaw;
  return { id:'q' + uid(), type, kind:c.kind || 'main', part:c.part || '1', secs:0, author:c.author || '', text, choices, answer, expl, dots:'', memo, _src:c, _hasAns:!!ansRaw };
}
// 문제 구분: main(본문제, 점수) · practice(연습, 점수 없음) · event(이벤트 퀴즈, 점수 없음) · final(결승: 동점자 순위 가리기에만 씀)
const KINDS = { main:'본문제', practice:'연습', event:'이벤트', final:'결승' };
// 서버에서 읽은 문제를 빈 칸 없이 맞춤 (Realtime Database는 빈 배열·빈 값을 저장하지 않음)
function normQ(q){
  q = q || {};
  return { id:String(q.id || 'q' + uid()), type:['ox', 'choice', 'short'].includes(q.type) ? q.type : 'ox',
    kind:KINDS[q.kind] ? q.kind : 'main', part:q.part === '2' ? '2' : '1', secs:Number(q.secs) || 0,
    author:String(q.author || ''), text:String(q.text || ''),
    choices:Array.isArray(q.choices) ? q.choices.map(String) : (q.choices && typeof q.choices === 'object' ? Object.values(q.choices).map(String) : []),
    answer:String(q.answer ?? ''), expl:String(q.expl || ''), dots:String(q.dots || ''), memo:String(q.memo || '') };
}
const asList = v => Array.isArray(v) ? v.filter(x => x != null) : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]).filter(x => x != null) : []);
