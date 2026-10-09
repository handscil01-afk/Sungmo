'use strict';
/* ================= 성경 본문 =================
   본문은 사용자가 가진 파일을 불러와 이 기기(IndexedDB)에만 저장합니다. 공개 사이트에는 올라가지 않습니다. */
const BOOKS=[ // [약어, 이름, 대한성서공회 코드, 다른 이름들]
['창','창세기','gen'],['출','출애굽기','exo'],['레','레위기','lev'],['민','민수기','num'],['신','신명기','deu'],['수','여호수아','jos'],['삿','사사기','jdg'],['룻','룻기','rut'],
['삼상','사무엘상','1sa'],['삼하','사무엘하','2sa'],['왕상','열왕기상','1ki'],['왕하','열왕기하','2ki'],['대상','역대상','1ch'],['대하','역대하','2ch'],['스','에스라','ezr'],['느','느헤미야','neh'],
['에','에스더','est'],['욥','욥기','job'],['시','시편','psa'],['잠','잠언','pro'],['전','전도서','ecc'],['아','아가','sng'],['사','이사야','isa'],['렘','예레미야','jer'],['애','예레미야애가','lam'],
['겔','에스겔','ezk'],['단','다니엘','dan'],['호','호세아','hos'],['욜','요엘','jol'],['암','아모스','amo'],['옵','오바댜','oba'],['욘','요나','jnh'],['미','미가','mic'],['나','나훔','nam'],
['합','하박국','hab'],['습','스바냐','zep'],['학','학개','hag'],['슥','스가랴','zec'],['말','말라기','mal'],
['마','마태복음','mat'],['막','마가복음','mrk'],['눅','누가복음','luk'],['요','요한복음','jhn'],['행','사도행전','act'],['롬','로마서','rom'],['고전','고린도전서','1co'],['고후','고린도후서','2co'],
['갈','갈라디아서','gal'],['엡','에베소서','eph'],['빌','빌립보서','php'],['골','골로새서','col'],['살전','데살로니가전서','1th'],['살후','데살로니가후서','2th'],['딤전','디모데전서','1ti'],['딤후','디모데후서','2ti'],
['딛','디도서','tit'],['몬','빌레몬서','phm'],['히','히브리서','heb'],['약','야고보서','jas'],['벧전','베드로전서','1pe'],['벧후','베드로후서','2pe'],['요일','요한일서','1jn'],['요이','요한이서','2jn'],['요삼','요한삼서','3jn'],
['유','유다서','jud'],['계','요한계시록','rev']];
const BOOK_INDEX=(()=>{const m={};BOOKS.forEach(([a,n,c],i)=>{m[a]=i;m[n]=i;m[c]=i;m[n.replace(/(기|서|복음)$/,'')]=m[n.replace(/(기|서|복음)$/,'')]??i});
  Object.assign(m,{'창세':0,'출애굽':1,'레위':2,'민수':3,'신명':4,'사사':6,'룻':7,'욥':17,'시':18,'잠':19,'전도':20,'아가서':21,'애가':24,'계시록':65,'요한계시록':65,'마태':39,'마가':40,'누가':41,'요한':42,'사도':43,'로마':44,'갈라디아':47,'에베소':48,'빌립보':49,'골로새':50,'히브리':57,'야고보':58,'유다':64,'빌레몬':56,'디도':55});
  return m})();
function bookOf(s){s=String(s||'').replace(/\s/g,'');return BOOK_INDEX[s]}

/* "창 12:1-4; 삼상 3:3", "출 7–12장", "창 37:3, 28", "계 2–3장" → [{b,c1,c2,v:[[s,e]]|null, text}] */
function parseRefs(ref){
  const out=[];let lastB=null;
  for(let part of String(ref||'').split(/[;；]/)){part=part.trim();if(!part)continue;
    let m=part.match(/^([가-힣]+)\s*(.*)$/),b=lastB,rest=part;
    if(m&&bookOf(m[1])!=null){b=bookOf(m[1]);rest=m[2]}
    if(b==null)continue;lastB=b;rest=rest.replace(/[–—~]/g,'-').trim();
    let mm;
    if((mm=rest.match(/^(\d+)\s*-\s*(\d+)\s*장$/)))out.push({b,c1:+mm[1],c2:+mm[2],v:null,text:part});
    else if((mm=rest.match(/^(\d+)\s*장$/)))out.push({b,c1:+mm[1],c2:+mm[1],v:null,text:part});
    else if((mm=rest.match(/^(\d+)\s*:\s*(\d+)\s*-\s*(\d+)\s*:\s*(\d+)$/)))out.push({b,c1:+mm[1],c2:+mm[3],v:[[+mm[2],999]],vEnd:+mm[4],text:part});
    else if((mm=rest.match(/^(\d+)\s*:\s*(.+)$/))){const c=+mm[1],v=[];
      for(const seg of mm[2].split(',')){const r=seg.trim().match(/^(\d+)(?:\s*-\s*(\d+))?/);if(r)v.push([+r[1],r[2]?+r[2]:+r[1]])}
      out.push({b,c1:c,c2:c,v:v.length?v:null,text:part})}
  }
  return out}
const refTitle=r=>{const n=BOOKS[r.b][1];if(!r.v)return r.c1===r.c2?`${n} ${r.c1}장`:`${n} ${r.c1}–${r.c2}장`;
  if(r.vEnd)return `${n} ${r.c1}장 ${r.v[0][0]}절 – ${r.c2}장 ${r.vEnd}절`;return `${n} ${r.c1}장 ${r.v.map(([s,e])=>s===e?s:`${s}–${e}`).join(', ')}절`};
const bskUrl=r=>`https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book=${BOOKS[r.b][2]}&chap=${r.c1}&sec=${r.v?r.v[0][0]:1}`;

const Bible={data:null,meta:null,loading:null,
  async load(){if(this.data)return this.data;if(this.loading)return this.loading;
    this.loading=(async()=>{const d=await IDB.get('bible');if(d&&d.books){this.data=d.books;this.meta=d.meta}return this.data})();return this.loading},
  async info(){if(this.meta)return this.meta;const d=await IDB.get('bible-meta');this.meta=d||null;return this.meta},
  verse(b,c,v){const B=this.data&&this.data[b];return B&&B[c]?B[c][v]:undefined},
  chapterLen(b,c){const B=this.data&&this.data[b];return B&&B[c]?Math.max(0,...Object.keys(B[c]).map(Number)):0},
  async save(books,name){let count=0;for(const b in books)for(const c in books[b])count+=Object.keys(books[b][c]).length;
    const meta={name,count,books:Object.keys(books).length,date:new Date().toISOString()};
    await IDB.set('bible',{books,meta});await IDB.set('bible-meta',meta);this.data=books;this.meta=meta;return meta},
  async clear(){await IDB.del('bible');await IDB.del('bible-meta');this.data=null;this.meta=null},
  /* 여러 형식을 읽습니다: "창1:1 본문", "창세기 1:1 본문", "창세기 1장 1절 본문", 책 이름 줄 + "1:1 본문",
     CSV/TSV(책,장,절,본문), JSON([{book,chapter,verse,text}] 또는 {책:{장:{절:본문}}}) */
  parse(text,opt={}){
    let last=null;const strip=t=>{t=String(t==null?'':t).trim();if(opt.stripHead!==false)t=t.replace(/^(<[^>]{1,40}>\s*)+/,'').trim();return t};
    const books={},add=(b,c,v,t)=>{t=strip(t);if(b==null||!c||!v||!t)return;(books[b]=books[b]||{});(books[b][c]=books[b][c]||{})[v]=t;last={b,c,v}};
    let bad=0,lines=0;const t=text.trim();
    if(/^[\[{]/.test(t)){try{const j=JSON.parse(t);
      if(Array.isArray(j))for(const r of j){const b=bookOf(r.book??r.책??r.b);add(b,+(r.chapter??r.장??r.c),+(r.verse??r.절??r.v),r.text??r.본문??r.t)}
      else for(const [bk,ch] of Object.entries(j)){const b=bookOf(bk);if(b==null)continue;for(const [c,vs] of Object.entries(ch))for(const [v,tx] of Object.entries(vs))add(b,+c,+v,tx)}
      return {books,bad:0,lines:0}}catch(e){}}
    let curB=null;
    for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line)continue;lines++;let m;
      const cells=line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x=>x.replace(/^"|"$/g,'').trim());
      if(cells.length>=4&&bookOf(cells[0])!=null&&/^\d+$/.test(cells[1])&&/^\d+$/.test(cells[2])){add(bookOf(cells[0]),+cells[1],+cells[2],cells.slice(3).join(', '));continue}
      if((m=line.match(/^<?\s*([가-힣]+|[1-3]?[a-z]{2,3})\s*\.?\s*(\d+)\s*(?::|장)\s*(\d+)\s*절?\s*>?\s*(.*)$/i))&&bookOf(m[1])!=null){curB=bookOf(m[1]);add(curB,+m[2],+m[3],m[4]);continue}
      if((m=line.match(/^(\d+)\s*:\s*(\d+)\s+(.*)$/))&&curB!=null){add(curB,+m[1],+m[2],m[3]);continue}
      /* 절 번호가 빠진 줄(예: "창35:야곱의 아들은 열둘이라")은 한 절이 둘로 나뉜 뒷부분이라 같은 장의 바로 앞 절에 이어 붙입니다 */
      if((m=line.match(/^<?\s*([가-힣]+)\s*(\d+)\s*:\s*(\D.*)$/))&&bookOf(m[1])!=null&&last&&last.b===bookOf(m[1])&&last.c===+m[2]){
        const t=strip(m[3]).replace(/<[^>]{1,40}>\s*/g,'').trim();if(t){books[last.b][last.c][last.v]+=' '+t;continue}}
      /* 새 장의 첫 줄인데 절 번호가 없으면 1절로 넣습니다 (시편의 "제이권" 같은 권 제목은 본문이 아니라 건너뜀) */
      if((m=line.match(/^<?\s*([가-힣]+)\s*(\d+)\s*:\s*(\D.*)$/))&&bookOf(m[1])!=null){const b=bookOf(m[1]),c=+m[2],t=strip(m[3]).replace(/<[^>]{1,40}>\s*/g,'').trim();
        if(/^제[일이삼사오육칠팔구십]+권$/.test(t))continue;if(t&&!(books[b]&&books[b][c]&&books[b][c][1])){add(b,c,1,t);continue}}
      if(bookOf(line.replace(/\s*\d*장?$/,''))!=null&&line.length<12){curB=bookOf(line.replace(/\s*\d*장?$/,''));continue}
      bad++}
    return {books,bad,lines}}
};
