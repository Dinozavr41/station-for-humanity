const PRESETS={
  rpk_altai_openings:'("new hotel" OR "new store" OR "new restaurant" OR "new branch" OR opening) (Altai OR Biysk OR Barnaul)',
  rpk_altai_construction:'(construction OR "opening soon" OR "commissioned" OR "new complex") (Altai OR Biysk OR Barnaul)',
  rpk_altai_rebrand:'(rebrand OR rebranding OR rename OR "new brand") (Altai OR Biysk OR Barnaul)',
  rpk_altai_events:'(festival OR exhibition OR fair OR conference OR forum) (Altai OR Biysk OR Barnaul)'
};
const cache=new Map();
const TTL=10*60*1000;
function cleanArticle(a={}){return{url:String(a.url||'').slice(0,2000),title:String(a.title||'').slice(0,1000),seendate:a.seendate||null,domain:String(a.domain||'').slice(0,300),language:String(a.language||'').slice(0,80),sourcecountry:String(a.sourcecountry||'').slice(0,120),socialimage:String(a.socialimage||'').slice(0,2000)}}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const preset=String(req.query?.preset||'rpk_altai_openings');
  const query=PRESETS[preset];if(!query)return res.status(400).json({ok:false,error:'unsupported_preset',allowed:Object.keys(PRESETS)});
  const hit=cache.get(preset);if(hit&&Date.now()-hit.at<TTL){res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=3600');return res.status(200).json({...hit.data,cache:'memory'});}
  const u=new URL('https://api.gdeltproject.org/api/v2/doc/doc');u.searchParams.set('query',query);u.searchParams.set('mode','artlist');u.searchParams.set('maxrecords','50');u.searchParams.set('format','json');u.searchParams.set('timespan','30d');u.searchParams.set('sort','datedesc');
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),20000);
  try{
    const r=await fetch(u,{headers:{'user-agent':'StationNeedRadar/1.0 (+https://stationforhumanity.com)','accept':'application/json'},signal:ctl.signal});
    const text=await r.text();
    if(r.status===429){if(hit)return res.status(200).json({...hit.data,cache:'stale',warning:'gdelt_rate_limited'});return res.status(503).json({ok:false,error:'gdelt_rate_limited',retry_after_seconds:300});}
    if(!r.ok)return res.status(502).json({ok:false,error:'gdelt_upstream_error',status:r.status});
    let j;try{j=JSON.parse(text)}catch{return res.status(502).json({ok:false,error:'gdelt_invalid_json'})}
    const articles=Array.isArray(j?.articles)?j.articles.map(cleanArticle):[];
    const data={ok:true,source:'GDELT',attribution:'GDELT Project — https://www.gdeltproject.org/',preset,query,items_count:articles.length,articles};cache.set(preset,{at:Date.now(),data});
    res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=3600');return res.status(200).json(data);
  }catch(e){if(hit)return res.status(200).json({...hit.data,cache:'stale',warning:'gdelt_fetch_failed'});return res.status(504).json({ok:false,error:'gdelt_fetch_failed',detail:String(e?.name==='AbortError'?'timeout':e?.message||e)})}
  finally{clearTimeout(timer)}
}
