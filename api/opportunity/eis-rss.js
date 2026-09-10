const ALLOWED = new Map([
  ['signage','вывеска'],
  ['banner','баннер'],
  ['outdoor','наружная реклама'],
  ['rim','рекламно-информационные материалы'],
  ['stands','стенд'],
  ['plates','табличка'],
  ['print','полиграфия'],
  ['branding','брендированная продукция']
]);

function decodeXml(s=''){
  return String(s).replace(/^<!\[CDATA\[|\]\]>$/g,'')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').trim();
}
function stripHtml(s=''){return decodeXml(s).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function tag(block,name){const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));return m?decodeXml(m[1]):''}
function linkFrom(block){const direct=tag(block,'link');if(direct)return direct;const m=block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);return m?decodeXml(m[1]):''}
function parseFeed(xml){
  const items=[];let m;const rx=/<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  while((m=rx.exec(xml))&&items.length<100){const b=m[1];items.push({id:tag(b,'guid')||linkFrom(b)||tag(b,'title'),title:stripHtml(tag(b,'title')),link:linkFrom(b),published_at:tag(b,'pubDate')||tag(b,'date')||null,description:stripHtml(tag(b,'description'))})}
  if(items.length)return items;
  const ax=/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while((m=ax.exec(xml))&&items.length<100){const b=m[1];items.push({id:tag(b,'id')||linkFrom(b)||tag(b,'title'),title:stripHtml(tag(b,'title')),link:linkFrom(b),published_at:tag(b,'updated')||tag(b,'published')||null,description:stripHtml(tag(b,'summary')||tag(b,'content'))})}
  return items;
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const key=String(req.query?.q||'signage');const search=ALLOWED.get(key);
  if(!search)return res.status(400).json({ok:false,error:'unsupported_query',allowed:[...ALLOWED.keys()]});
  const u=new URL('https://zakupki.gov.ru/epz/order/extendedsearch/rss.html');
  u.searchParams.set('searchString',search);u.searchParams.set('morphology','on');u.searchParams.set('pageNumber','1');u.searchParams.set('sortBy','UPDATE_DATE');u.searchParams.set('sortDirection','false');u.searchParams.set('recordsPerPage','_50');u.searchParams.set('showLotsInfoHidden','false');u.searchParams.set('fz44','on');u.searchParams.set('fz223','on');u.searchParams.set('af','on');u.searchParams.set('ca','on');u.searchParams.set('pc','on');u.searchParams.set('pa','on');u.searchParams.set('currencyIdGeneral','-1');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
  try{
    const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0 (compatible; StationOpportunityEngine/1.0; +https://stationforhumanity.com)','accept':'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9,*/*;q=0.5'},signal:controller.signal,redirect:'follow'});
    const body=await r.text();
    if(!r.ok)return res.status(502).json({ok:false,error:'eis_upstream_error',status:r.status});
    const items=parseFeed(body).filter(x=>x.title||x.link);
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ok:true,source:'EIS RSS',query:key,search,items_count:items.length,items});
  }catch(e){return res.status(504).json({ok:false,error:'eis_fetch_failed',detail:String(e?.name==='AbortError'?'timeout':e?.message||e)})}
  finally{clearTimeout(timer)}
}
