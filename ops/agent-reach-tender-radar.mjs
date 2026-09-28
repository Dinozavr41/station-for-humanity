import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(fs.readFileSync(path.join(DIR,'agent-reach-tender.config.json'),'utf8'));
const push=process.argv.includes('--push');
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',windowsHide:true,timeout:60000});
const json=s=>{try{return JSON.parse(s)}catch{const m=s.match(/[\[{][\s\S]*[\]}]/);return m?JSON.parse(m[0]):null}};
const collect=(v,out=[])=>{if(!v||out.length>300)return out;if(Array.isArray(v)){v.forEach(x=>collect(x,out));return out}if(typeof v!=='object')return out;const u=v.url||v.link||v.source_url;if(typeof u==='string'&&/^https?:\/\//.test(u))out.push({url:u,title:String(v.title||v.name||''),text:String(v.text||v.snippet||v.summary||v.description||'')});Object.values(v).forEach(x=>{if(x&&typeof x==='object')collect(x,out)});return out};
const hosts=['zakupki.gov.ru','zakupki.mos.ru','roseltorg.ru','rts-tender.ru','sberbank-ast.ru','lot-online.ru','etpgpb.ru','fabrikant.ru','b2b-center.ru','tektorg.ru'];
const host=u=>{try{return new URL(u).hostname.toLowerCase().replace(/^www\./,'')}catch{return''}};
const allowed=h=>hosts.some(x=>h===x||h.endsWith('.'+x));
const tender=/тендер|закупк|44[- ]?фз|223[- ]?фз|аукцион|котиров|запрос предлож/iu, service=/баннер|вывес|таблич|стенд|полиграф|печат|наружн\w* реклам|рекламно-информац|брендирован|светов\w* конструкц/iu;
const money=t=>{const m=t.replace(/\u00a0/g,' ').match(/([\d\s]{3,}(?:[.,]\d{1,2})?)\s*(?:₽|руб(?:\.|лей)?)/iu);if(!m)return null;const n=Number(m[1].replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:null};
const purchase=t=>t.match(/\b\d{18,19}\b/)?.[0]||null;
const enrich=async u=>{try{const c=new AbortController(),tm=setTimeout(()=>c.abort(),12000),r=await fetch('https://r.jina.ai/'+u,{signal:c.signal});clearTimeout(tm);return r.ok?(await r.text()).slice(0,12000):''}catch{return''}};
try{run('agent-reach',['doctor','--json'])}catch{console.error('Agent Reach is not ready. Run ops/install-agent-reach.ps1');process.exit(2)}
let rows=[];
for(const q of cfg.queries){try{const raw=run('mcporter',['call','exa.web_search_exa',`query=${q.query}`,`numResults=${cfg.result_limit_per_query||8}`]);for(const r of collect(json(raw)))rows.push({...r,category:q.category,query:q.query})}catch(e){console.warn('search failed:',q.query,e.message)}}
const map=new Map();for(const r of rows){const h=host(r.url),txt=(r.title+' '+r.text).toLowerCase();let s=(tender.test(txt)?35:0)+(service.test(txt)?35:0)+(allowed(h)?15:0);if(!allowed(h)||s<(cfg.min_score||55))continue;const key=r.url.replace(/[?#].*$/,'');if(!map.has(key)||map.get(key).score<s)map.set(key,{...r,score:s,source_host:h})}
rows=[...map.values()].sort((a,b)=>b.score-a.score);for(const r of rows.slice(0,cfg.enrich_top||20))r.page=await enrich(r.url);
rows=rows.map(r=>{const t=`${r.title}\n${r.text}\n${r.page||''}`;const law=/44[- ]?фз/iu.test(t)?'44-FZ':/223[- ]?фз/iu.test(t)?'223-FZ':null;return {title:r.title||'Тендер',description:(r.text||r.page||'').slice(0,12000),source_url:r.url,source_host:r.source_host,category:r.category,discovery_query:r.query,discovery_score:r.score,purchase_number:purchase(t),budget_max:money(t),law,official_source:r.source_host==='zakupki.gov.ru'||r.source_host.endsWith('.zakupki.gov.ru'),requires_human_review:true,auto_submit:false}});
fs.mkdirSync(path.join(DIR,'out'),{recursive:true});const file=path.join(DIR,'out',`agent-reach-tenders-${new Date().toISOString().replace(/[:.]/g,'-')}.jsonl`);fs.writeFileSync(file,rows.map(x=>JSON.stringify(x)).join('\n')+(rows.length?'\n':''));console.log(`Agent Reach: ${rows.length} candidates -> ${file}`);
if(push){const url=process.env.AGENT_REACH_INGEST_URL,token=process.env.AGENT_REACH_INGEST_TOKEN;if(!url||!token)throw new Error('AGENT_REACH_INGEST_URL/TOKEN required');const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-agent-reach-token':token},body:JSON.stringify({items:rows})});console.log('ingest',r.status,await r.text());if(!r.ok)process.exit(3)}
