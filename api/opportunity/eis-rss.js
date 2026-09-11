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
function officialLink(v=''){try{const u=new URL(v,'https://zakupki.gov.ru');return (u.hostname==='zakupki.gov.ru'||u.hostname.endsWith('.zakupki.gov.ru'))?u.href:''}catch{return ''}}
function purchaseNo(text=''){return text.match(/\b\d{18,19}\b/)?.[0]||null}
function money(text=''){
  const t=text.replace(/\u00a0/g,' ');
  for(const p of [/(?:начальн\w*\s+(?:максимальн\w*\s+)?цен\w*|нмцк|цена контракта)[^\d]{0,80}([\d\s]{2,}(?:[.,]\d{1,2})?)/iu,/([\d\s]{3,}(?:[.,]\d{1,2})?)\s*(?:₽|руб(?:\.|лей)?)/iu]){
    const m=t.match(p);if(!m)continue;const n=Number(m[1].replace(/\s/g,'').replace(',','.'));if(Number.isFinite(n)&&n>=0)return n;
  }
  return null;
}
function deadline(text=''){
  const m=text.match(/(?:окончани(?:е|я) подачи|дата окончания|прием заявок до)[^\d]{0,80}(\d{2})\.(\d{2})\.(\d{4})(?:[^\d]{0,12}(\d{1,2}):(\d{2}))?/iu);
  if(!m)return null;
  // В карточках ЕИС время процедур публикуется по МСК; фиксируем +03:00 явно, чтобы браузер корректно перевёл в локальное время пользователя.
  const iso=`${m[3]}-${m[2]}-${m[1]}T${String(m[4]||23).padStart(2,'0')}:${String(m[5]||59).padStart(2,'0')}:00+03:00`;const dt=new Date(iso);
  return Number.isNaN(dt.getTime())?null:dt.toISOString();
}
function parseFeed(xml,key,search){
  const blocks=[];let m;const rx=/<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  while((m=rx.exec(xml))&&blocks.length<100)blocks.push(m[1]);
  if(!blocks.length){const ax=/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;while((m=ax.exec(xml))&&blocks.length<100)blocks.push(m[1])}
  return blocks.map(b=>{
    const title=stripHtml(tag(b,'title'));const description=stripHtml(tag(b,'description')||tag(b,'summary')||tag(b,'content'));const link=officialLink(linkFrom(b));
    if(!link||(!title&&!description))return null;
    const combined=`${title} ${description}`;const publishedRaw=tag(b,'pubDate')||tag(b,'updated')||tag(b,'published')||tag(b,'date');
    const published=publishedRaw&&!Number.isNaN(Date.parse(publishedRaw))?new Date(publishedRaw).toISOString():null;
    const number=purchaseNo(combined)||purchaseNo(link);const id=number||tag(b,'guid')||tag(b,'id')||link;
    return {id,purchase_number:number,title:title||description,description,source_url:link,published_at:published,deadline_at:deadline(combined),budget_max:money(combined),currency:'RUB',law:'44-FZ',source:'ЕИС',category:key,search};
  }).filter(Boolean);
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const key=String(req.query?.q||'banner');const search=ALLOWED.get(key);
  if(!search)return res.status(400).json({ok:false,error:'unsupported_query',allowed:[...ALLOWED.keys()]});
  const u=new URL('https://zakupki.gov.ru/epz/order/extendedsearch/rss.html');
  u.searchParams.set('searchString',search);u.searchParams.set('morphology','on');u.searchParams.set('pageNumber','1');u.searchParams.set('sortBy','UPDATE_DATE');u.searchParams.set('sortDirection','false');u.searchParams.set('recordsPerPage','_50');u.searchParams.set('showLotsInfoHidden','false');
  // Боевой контур пользователя: только 44-ФЗ. 223-ФЗ и коммерческие процедуры сюда намеренно не смешиваются.
  u.searchParams.set('fz44','on');u.searchParams.set('currencyIdGeneral','-1');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
  try{
    const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0 (compatible; StationTender44FZ/1.0; +https://stationforhumanity.com)','accept':'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9,*/*;q=0.5'},signal:controller.signal,redirect:'follow'});
    const body=await r.text();if(!r.ok)return res.status(502).json({ok:false,error:'eis_upstream_error',status:r.status});
    const items=parseFeed(body,key,search);
    res.setHeader('Cache-Control','s-maxage=180, stale-while-revalidate=300');
    return res.status(200).json({ok:true,source:'ЕИС',law:'44-FZ',query:key,search,items_count:items.length,items});
  }catch(e){return res.status(504).json({ok:false,error:'eis_fetch_failed',detail:String(e?.name==='AbortError'?'timeout':e?.message||e)})}
  finally{clearTimeout(timer)}
}
