'use strict';
/* ================= 엑셀(.xlsx)·CSV 읽고 쓰기 =================
   외부 라이브러리 없이 동작합니다. 쓰기는 압축하지 않은 zip, 읽기는 브라우저의 deflate-raw 해제 기능을 씁니다. */
const XLSX_LITE=(()=>{
  const enc=new TextEncoder();
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
  const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
  const xml=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
  const colName=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=(i-m-1)/26|0}return s};
  const colIndex=ref=>{const m=/^([A-Z]+)/.exec(ref);if(!m)return -1;let n=0;for(const ch of m[1])n=n*26+ch.charCodeAt(0)-64;return n-1};

  function zip(files){ // files: [{name, data:Uint8Array}]
    const parts=[],central=[];let off=0;
    for(const f of files){
      const name=enc.encode(f.name),d=f.data,crc=crc32(d);
      const h=new DataView(new ArrayBuffer(30));
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);
      h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,name.length,true);
      parts.push(new Uint8Array(h.buffer),name,d);
      const c=new DataView(new ArrayBuffer(46));
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
      c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
      central.push(new Uint8Array(c.buffer),name);
      off+=30+name.length+d.length;
    }
    const csize=central.reduce((s,b)=>s+b.length,0),e=new DataView(new ArrayBuffer(22));
    e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
    return new Blob([...parts,...central,new Uint8Array(e.buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function sheetXml(rows,widths){
    const cols=widths&&widths.length?`<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`:'';
    const body=rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{if(v==null||v==='')return '';const ref=colName(ci)+(ri+1),st=ri===0?' s="1"':' s="2"';
      return typeof v==='number'&&isFinite(v)?`<c r="${ref}"${st}><v>${v}</v></c>`:`<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`}).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`;
  }
  /* sheets: [{name, rows:[[셀...]], widths:[열 너비]}] → Blob */
  function write(sheets){
    const f=(name,s)=>({name,data:enc.encode(s)});
    const files=[
      f('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
      f('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
      f('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(String(s.name).slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`),
      f('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
      f('xl/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE3A6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`),
      ...sheets.map((s,i)=>f(`xl/worksheets/sheet${i+1}.xml`,sheetXml(s.rows,s.widths)))];
    return zip(files);
  }
  async function inflate(bytes){
    if(typeof DecompressionStream==='undefined')throw new Error('이 브라우저는 엑셀 파일 읽기를 지원하지 않아요. 최신 크롬·엣지·사파리를 쓰거나 CSV로 저장해 주세요.');
    const ds=new DecompressionStream('deflate-raw');const out=new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function unzip(buf){
    const u=new Uint8Array(buf),v=new DataView(buf);let e=-1;
    for(let i=u.length-22;i>=Math.max(0,u.length-70000);i--)if(v.getUint32(i,true)===0x06054b50){e=i;break}
    if(e<0)throw new Error('엑셀(.xlsx) 파일이 아니거나 손상된 파일이에요.');
    const n=v.getUint16(e+10,true);let p=v.getUint32(e+16,true);const out={},dec=new TextDecoder();
    for(let k=0;k<n;k++){
      if(v.getUint32(p,true)!==0x02014b50)break;
      const method=v.getUint16(p+10,true),csize=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),xl=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),lo=v.getUint32(p+42,true);
      const name=dec.decode(u.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
      const ds=lo+30+v.getUint16(lo+26,true)+v.getUint16(lo+28,true);const raw=u.subarray(ds,ds+csize);
      out[name]={method,raw};
    }
    return {async text(name){const f=out[name]||out[Object.keys(out).find(k=>k.toLowerCase()===name.toLowerCase())];if(!f)return null;
      const b=f.method===0?f.raw:await inflate(f.raw);return dec.decode(b)},names:Object.keys(out)};
  }
  const tags=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
  const parseXml=s=>new DOMParser().parseFromString(s,'application/xml');
  /* .xlsx → [{name, rows}] */
  async function read(buf){
    const z=await unzip(buf);
    const wb=parseXml(await z.text('xl/workbook.xml')||'');
    const relsTxt=await z.text('xl/_rels/workbook.xml.rels');const rels={};
    if(relsTxt)for(const r of tags(parseXml(relsTxt),'Relationship'))rels[r.getAttribute('Id')]=r.getAttribute('Target');
    const ssTxt=await z.text('xl/sharedStrings.xml');const ss=ssTxt?tags(parseXml(ssTxt),'si').map(si=>tags(si,'t').map(t=>t.textContent).join('')):[];
    const out=[];
    for(const sh of tags(wb,'sheet')){
      const rid=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
      let target=rels[rid]||'';target=target.replace(/^\/?xl\//,'').replace(/^\//,'');
      const txt=await z.text('xl/'+target);if(!txt)continue;
      const doc=parseXml(txt),rows=[];
      for(const r of tags(doc,'row')){const ri=(+r.getAttribute('r')||rows.length+1)-1,row=rows[ri]=[];let ci=0;
        for(const c of tags(r,'c')){const ref=c.getAttribute('r');if(ref)ci=colIndex(ref);const t=c.getAttribute('t');let val='';
          if(t==='inlineStr')val=tags(c,'t').map(x=>x.textContent).join('');
          else{const vv=tags(c,'v')[0];val=vv?vv.textContent:'';if(t==='s')val=ss[+val]||'';else if(t==='b')val=val==='1'?'TRUE':'FALSE';
            else if(t!=='str'&&t!=='e'&&val!==''&&!isNaN(+val))val=+val}
          row[ci++]=val}}
      for(let i=0;i<rows.length;i++)if(!rows[i])rows[i]=[];
      out.push({name:sh.getAttribute('name'),rows});
    }
    return out;
  }
  /* CSV (엑셀에서 한글이 깨지지 않도록 BOM을 붙입니다) */
  function toCSV(rows){return '﻿'+rows.map(r=>r.map(v=>{v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\r\n')}
  function parseCSV(s){s=s.replace(/^﻿/,'');const sep=(s.split('\n')[0].match(/\t/g)||[]).length>(s.split('\n')[0].match(/,/g)||[]).length?'\t':',';
    const rows=[];let row=[],cell='',q=false;
    for(let i=0;i<s.length;i++){const ch=s[i];
      if(q){if(ch==='"'){if(s[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}
      else if(ch==='"')q=true;else if(ch===sep){row.push(cell);cell=''}else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}else cell+=ch}
    if(cell!==''||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
    return rows}
  return {write,read,toCSV,parseCSV};
})();
