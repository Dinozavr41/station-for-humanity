const UA='Mozilla/5.0 (compatible; StationTenderFetcher/1.2; +https://stationforhumanity.com)';
const OLD='https://old.zakupki.mos.ru/api/Cssp';
const NEW='https://zakupki.mos.ru/newapi/api';
const SITE='https://zakupki.mos.ru';
const JINA='https://r.jina.ai/';

async function fetchText(url,options={},ms=7000){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  try{
    const r=await fetch(url,{...options,headers:{'user-agent':UA,'accept':'application/json,text/html,text/plain,*/*',...(options.headers||{})},signal:c.signal,redirect:'follow'});
    const text=await r.text();
    return {ok:r.ok,status:r.status,text,contentType:r.headers.get('content-type')||'',finalUrl:r.url};
  }catch(e){return {ok:false,status:0,text:'',error:e?.name==='AbortError'?'timeout':String(e?.message||e)}}
  finally{clearTimeout(t)}
}
function parseJson(x){try{return JSON.parse(x)}catch{return null}}
function compactItem(x){return x&&{number:x.number??x.id??null,name:x.name??null,needId:x.needId??(x.items?.[0]?.needId)??(x.purchaseTypeId?x.id:null),tenderId:x.tenderId??null,auctionId:x.auctionId??null,beginDate:x.beginDate??x.proposalStartDate??null,endDate:x.endDate??x.proposalEndDate??null,startPrice:x.startPrice??x.nmck??null,stateName:x.stateName??x.state?.name??null,regionName:x.regionName??x.region?.name??null}}
function matchItem(x,number,title){
  if(String(x?.number??x?.id??'').trim()===number)return true;
  if(title&&String(x?.name??'').trim().toLowerCase()===title.trim().toLowerCase())return true;
  return false;
}
async function jinaJson(target,ms=15000){
  const r=await fetchText(`${JINA}${target}`,{headers:{accept:'application/json','x-respond-timing':'html','x-timeout':'10'}},ms);
  const outer=parseJson(r.text);const inner=parseJson(outer?.data?.content||'');
  return {ok:!!inner,status:outer?.data?.httpStatus??r.status,data:inner,error:r.error||(!inner?(outer?.readableMessage||outer?.message||'jina_parse_failed'):null)};
}
async function detailUrl(kind,id){
  if(kind==='need')return `${NEW}/Need/Get?needId=${encodeURIComponent(id)}`;
  if(kind==='auction')return `${NEW}/Auction/Get?auctionId=${encodeURIComponent(id)}`;
  return `${OLD}/Tender/GetEntity?id=${encodeURIComponent(id)}`;
}
async function fetchDetail(kind,id){
  const url=await detailUrl(kind,id);
  const direct=await fetchText(url,{},4000);const j=parseJson(direct.text);
  if(direct.ok&&j)return {kind,id,data:j,via:'direct',attempts:[{via:'direct',status:direct.status}]};
  if(kind!=='tender'){
    const proxy=await jinaJson(url,16000);
    if(proxy.ok)return {kind,id,data:proxy.data,via:'jina_public_reader',attempts:[{via:'direct',status:direct.status,error:direct.error||null},{via:'jina_public_reader',status:proxy.status}]};
    return {kind:null,id:null,data:null,via:null,attempts:[{via:'direct',status:direct.status,error:direct.error||null},{via:'jina_public_reader',status:proxy.status,error:proxy.error||null}]};
  }
  return {kind:null,id:null,data:null,via:null,attempts:[{via:'direct',status:direct.status,error:direct.error||null}]};
}
function queryPayload(typeIn,skip,take=100){
  const filter={auctionSpecificFilter:{stateIdIn:[19000002,19000005,19000003,19000004,19000008]},needSpecificFilter:{},tenderSpecificFilter:{}};
  if(typeIn)filter.typeIn=typeIn;
  if(typeIn?.includes(2))filter.needSpecificFilter={isB2B:false};
  return {filter,order:[{field:'PublishDate',desc:true}],withCount:true,take,skip};
}
async function queryOld(payload){
  const q=encodeURIComponent(JSON.stringify(payload));
  const r=await fetchText(`${OLD}/Purchase/Query?queryDto=${q}`,{},2500);
  if(r.ok&&parseJson(r.text))return {...r,method:'GET Query'};
  const post=await fetchText(`${OLD}/Purchase/PostQuery`,{method:'POST',headers:{'content-type':'application/json;charset=UTF-8'},body:JSON.stringify(payload)},2500);
  if(post.ok&&parseJson(post.text))return {...post,method:'POST PostQuery'};
  return {...(post.status?post:r),method:'failed'};
}
async function findPurchase(number,title){
  const probes=[];
  for(const typeIn of [[2],[1],null]){
    const r=await queryOld(queryPayload(typeIn,0,100));const j=parseJson(r.text);
    probes.push({typeIn,page:0,status:r.status,method:r.method,count:j?.count??null,error:r.error||null});
    if(!j?.items)continue;
    const hit=j.items.find(x=>matchItem(x,number,title));
    if(hit)return {hit,probes};
  }
  return {hit:null,probes};
}
function filesFrom(data){
  return (Array.isArray(data?.files)?data.files:[]).map((f,i)=>{
    const fs=f?.fileStorage||{};
    const id=f?.id??fs?.id??fs?.fileStorageId??null;
    const name=f?.name??f?.fileName??fs?.fileName??`file-${i+1}`;
    const direct=fs?.fileUrl??f?.fileUrl??null;
    const download=direct||(id?`${NEW}/FileStorage/Download?id=${encodeURIComponent(id)}`:null);
    return {id,name,url:download,raw_url:direct};
  }).filter(x=>x.id||x.url||x.name);
}
function pageSignals(html=''){
  const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]).slice(0,30);
  const links=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]).filter(x=>/purchase|need|auction|FileStorage|newapi/i.test(x)).slice(0,50);
  const api=[...new Set((html.match(/(?:https?:\/\/[^"'<> ]+|\/newapi\/api\/[^"'<> ]+)/gi)||[]).filter(x=>/newapi|FileStorage|Need|Auction|Purchase/i.test(x)))].slice(0,50);
  return {scripts,links,api,hasNextData:/__NEXT_DATA__/.test(html),hasNuxt:/__NUXT__/.test(html)};
}
async function modernProbe(number,mode){
  if(mode==='page'){
    const r=await fetchText(`${SITE}/purchase/${encodeURIComponent(number)}`,{},6000);
    return {ok:r.ok,status:r.status,error:r.error||null,final_url:r.finalUrl||null,content_type:r.contentType||null,length:r.text.length,signals:pageSignals(r.text)};
  }
  const d=await fetchDetail(mode,number);
  return {ok:!!d.data,status:d.data?200:0,kind:mode,via:d.via,message:d.data?.message||null,number:d.data?.number??d.data?.id??null,id:d.data?.id??d.data?.needId??d.data?.auctionId??null,name:d.data?.name||null,files:d.data?filesFrom(d.data):[],attempts:d.attempts};
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const number=String(req.query?.number||'').trim();
  const title=String(req.query?.title||'').trim().slice(0,300);
  const probe=String(req.query?.probe||'').trim();
  if(!/^\d{4,20}$/.test(number))return res.status(400).json({ok:false,error:'invalid_number'});
  if(probe){
    if(!['page','need','auction'].includes(probe))return res.status(400).json({ok:false,error:'invalid_probe'});
    const result=await modernProbe(number,probe);res.setHeader('Cache-Control','no-store');return res.status(200).json({ok:true,probe,result});
  }

  // Portal "need" numbers are commonly their public ids. Try the modern detail endpoints first.
  for(const kind of ['need','auction']){
    const d=await fetchDetail(kind,number);
    if(d.data&&matchItem(d.data,number,title)){
      const files=filesFrom(d.data);res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
      return res.status(200).json({ok:true,source:'АИС Портал поставщиков',number,match:compactItem(d.data),entity:{kind,id:d.id,via:d.via},files_count:files.length,files,detail_attempts:d.attempts});
    }
  }

  const found=await findPurchase(number,title);
  if(!found.hit)return res.status(404).json({ok:false,error:'purchase_not_found',number,probes:found.probes});
  const kind=found.hit.needId?'need':found.hit.auctionId?'auction':'tender';const id=found.hit.needId||found.hit.auctionId||found.hit.tenderId;
  const detail=await fetchDetail(kind,id);const files=filesFrom(detail.data);
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
  return res.status(200).json({ok:true,source:'АИС Портал поставщиков',number,match:compactItem(found.hit),entity:{kind:detail.kind,id:detail.id,via:detail.via},files_count:files.length,files,detail_attempts:detail.attempts,probes:found.probes});
}
