import crypto from 'node:crypto';
import zlib from 'node:zlib';

const NEED_ID='6198058';
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36';
const NEW=`https://zakupki.mos.ru/newapi/api/Need/Get?needId=${NEED_ID}`;
const OLD=`https://old.zakupki.mos.ru/api/Cssp/Need/GetEntity?id=${NEED_ID}`;

function textClean(s=''){
  return String(s).replace(/\u0000/g,' ').replace(/[\t\r]+/g,' ').replace(/ {2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}
function xmlText(s=''){
  return textClean(String(s)
    .replace(/<w:tab\b[^>]*\/?\s*>/g,'\t')
    .replace(/<w:br\b[^>]*\/?\s*>/g,'\n')
    .replace(/<\/w:p>/g,'\n')
    .replace(/<\/row>/gi,'\n')
    .replace(/<\/c>/gi,'\t')
    .replace(/<[^>]+>/g,' ')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&'));
}
function unzipEntries(buf){
  const out=[]; let p=0;
  while(p+30<=buf.length){
    if(buf.readUInt32LE(p)!==0x04034b50){p++;continue}
    const flags=buf.readUInt16LE(p+6),method=buf.readUInt16LE(p+8),compSize=buf.readUInt32LE(p+18),nameLen=buf.readUInt16LE(p+26),extraLen=buf.readUInt16LE(p+28);
    const name=buf.subarray(p+30,p+30+nameLen).toString('utf8');
    const start=p+30+nameLen+extraLen;
    if(flags&0x08){p=start+Math.max(compSize,1);continue}
    const data=buf.subarray(start,start+compSize);
    try{
      let raw;
      if(method===0)raw=data; else if(method===8)raw=zlib.inflateRawSync(data); else {p=start+compSize;continue}
      out.push({name,data:raw});
    }catch{}
    p=start+compSize;
  }
  return out;
}
function extractOfficeZip(buf,ext){
  const entries=unzipEntries(buf); const chunks=[];
  if(ext==='docx'){
    const names=['word/document.xml','word/header1.xml','word/header2.xml','word/footer1.xml','word/footnotes.xml','word/endnotes.xml'];
    for(const n of names){const e=entries.find(x=>x.name===n);if(e)chunks.push(`\n--- ${n} ---\n${xmlText(e.data.toString('utf8'))}`)}
  }else if(ext==='xlsx'){
    const wanted=entries.filter(x=>x.name==='xl/sharedStrings.xml'||/^xl\/worksheets\/sheet\d+\.xml$/.test(x.name)||x.name==='xl/workbook.xml');
    for(const e of wanted)chunks.push(`\n--- ${e.name} ---\n${xmlText(e.data.toString('utf8'))}`);
  }
  return textClean(chunks.join('\n')).slice(0,180000);
}
function printableRuns(s,min=4){
  const re=new RegExp(`[\\p{L}\\p{N}А-Яа-яЁё.,:;!?()№%+\\-×x\\/\\\\ ₽]{${min},}`,'gu');
  return [...String(s).matchAll(re)].map(m=>m[0].trim()).filter(x=>x.length>=min);
}
function extractLegacyDoc(buf){
  const variants=[];
  try{variants.push(new TextDecoder('utf-16le',{fatal:false}).decode(buf))}catch{}
  try{variants.push(new TextDecoder('windows-1251',{fatal:false}).decode(buf))}catch{}
  variants.push(buf.toString('latin1'));
  const seen=new Set(),lines=[];
  for(const v of variants){for(const x of printableRuns(v,5)){const y=textClean(x);if(y.length<5||seen.has(y))continue;seen.add(y);lines.push(y)}}
  return lines.join('\n').slice(0,180000);
}
async function fetchTimed(url,asBuffer=false){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),45000);
  try{
    const r=await fetch(url,{headers:{'user-agent':UA,'accept':'*/*'},redirect:'follow',signal:c.signal});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return asBuffer?Buffer.from(await r.arrayBuffer()):await r.json();
  }finally{clearTimeout(t)}
}
function normalizeFiles(data){
  const arr=[];
  for(const f of data?.files||[]){
    const fs=f?.fileStorage&&typeof f.fileStorage==='object'?f.fileStorage:null;
    const name=fs?.fileName||fs?.name||f?.name||f?.fileName||null;
    const id=fs?.id||f?.id||null;
    let url=fs?.fileUrl||fs?.url||f?.url||f?.fileUrl||null;
    if(!url&&id)url=`https://zakupki.mos.ru/newapi/api/FileStorage/Download?id=${id}`;
    if(url&&url.startsWith('/'))url=`https://zakupki.mos.ru${url}`;
    if(name&&url)arr.push({name,id,url});
  }
  return arr;
}
async function getCard(){
  const errors=[];
  for(const [label,url] of [['new',NEW],['old',OLD]]){
    try{const data=await fetchTimed(url);return {label,url,data,errors}}catch(e){errors.push(`${label}: ${e.message}`)}
  }
  throw new Error(errors.join(' | '));
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  try{
    const card=await getCard();
    const files=normalizeFiles(card.data);
    const docs=[];
    for(const f of files.slice(0,10)){
      try{
        const buf=await fetchTimed(f.url,true);
        const ext=(f.name.split('.').pop()||'').toLowerCase();
        let text='';
        if(ext==='docx'||ext==='xlsx')text=extractOfficeZip(buf,ext);
        else if(ext==='doc')text=extractLegacyDoc(buf);
        else text=textClean(buf.toString('utf8')).slice(0,180000);
        docs.push({...f,size:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),extracted_text:text});
      }catch(e){docs.push({...f,error:e.message})}
    }
    return res.status(200).json({ok:true,need_id:NEED_ID,source:card.label,source_url:card.url,source_errors:card.errors,card:{name:card.data?.name,deliveryPlace:card.data?.deliveryPlace,paymentTerms:card.data?.paymentTerms,contactPerson:card.data?.contactPerson,contactPhone:card.data?.contactPhone,startCost:card.data?.startCost,startDate:card.data?.startDate,endDate:card.data?.endDate,files_count:files.length},docs});
  }catch(e){return res.status(502).json({ok:false,error:'public_source_fetch_failed',detail:String(e?.message||e)})}
}
