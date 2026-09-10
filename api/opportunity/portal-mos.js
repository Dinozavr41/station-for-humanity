const UA='Mozilla/5.0 (compatible; StationTenderFetcher/1.0; +https://stationforhumanity.com)';
const OLD='https://old.zakupki.mos.ru/api/Cssp';
const NEW='https://zakupki.mos.ru/newapi/api';

async function fetchText(url,options={},ms=18000){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  try{
    const r=await fetch(url,{...options,headers:{'user-agent':UA,'accept':'application/json, text/plain, */*',...(options.headers||{})},signal:c.signal,redirect:'follow'});
    const text=await r.text();
    return {ok:r.ok,status:r.status,text,contentType:r.headers.get('content-type')||''};
  }catch(e){return {ok:false,status:0,text:'',error:e?.name==='AbortError'?'timeout':String(e?.message||e)}}
  finally{clearTimeout(t)}
}
function parseJson(x){try{return JSON.parse(x)}catch{return null}}
function compactItem(x){return x&&{number:x.number??null,name:x.name??null,needId:x.needId??null,tenderId:x.tenderId??null,auctionId:x.auctionId??null,beginDate:x.beginDate??null,endDate:x.endDate??null,startPrice:x.startPrice??null,stateName:x.stateName??null,regionName:x.regionName??null}}
function matchItem(x,number,title){
  if(String(x?.number??'').trim()===number)return true;
  if(title&&String(x?.name??'').trim().toLowerCase()===title.trim().toLowerCase())return true;
  return false;
}
function queryPayload(typeIn,skip,take=100){
  const filter={auctionSpecificFilter:{stateIdIn:[19000002,19000005,19000003,19000004,19000008]},needSpecificFilter:{},tenderSpecificFilter:{}};
  if(typeIn)filter.typeIn=typeIn;
  if(typeIn?.includes(2))filter.needSpecificFilter={isB2B:false};
  return {filter,order:[{field:'PublishDate',desc:true}],withCount:true,take,skip};
}
async function queryOld(payload){
  const q=encodeURIComponent(JSON.stringify(payload));
  let r=await fetchText(`${OLD}/Purchase/Query?queryDto=${q}`,{},18000);
  if(r.ok&&parseJson(r.text))return {...r,method:'GET Query'};
  const post=await fetchText(`${OLD}/Purchase/PostQuery`,{method:'POST',headers:{'content-type':'application/json;charset=UTF-8'},body:JSON.stringify(payload)},18000);
  if(post.ok&&parseJson(post.text))return {...post,method:'POST PostQuery'};
  return {...(post.status?post:r),method:'failed'};
}
async function findPurchase(number,title){
  const probes=[];
  for(const typeIn of [[2],[1],null]){
    for(let page=0;page<8;page++){
      const payload=queryPayload(typeIn,page*100,100);
      const r=await queryOld(payload);const j=parseJson(r.text);
      probes.push({typeIn,page,status:r.status,method:r.method,count:j?.count??null,error:r.error||null});
      if(!j?.items)break;
      const hit=j.items.find(x=>matchItem(x,number,title));
      if(hit)return {hit,probes};
      if(j.items.length<100)break;
    }
  }
  return {hit:null,probes};
}
async function getDetail(hit){
  const candidates=[];
  if(hit.needId)candidates.push({kind:'need',id:hit.needId,url:`${NEW}/Need/Get?needId=${encodeURIComponent(hit.needId)}`});
  if(hit.auctionId)candidates.push({kind:'auction',id:hit.auctionId,url:`${NEW}/Auction/Get?auctionId=${encodeURIComponent(hit.auctionId)}`});
  if(hit.tenderId)candidates.push({kind:'tender',id:hit.tenderId,url:`${OLD}/Tender/GetEntity?id=${encodeURIComponent(hit.tenderId)}`});
  const attempts=[];
  for(const c of candidates){
    const r=await fetchText(c.url,{},22000);const j=parseJson(r.text);
    attempts.push({kind:c.kind,id:c.id,status:r.status,error:r.error||null});
    if(r.ok&&j)return {kind:c.kind,id:c.id,data:j,attempts};
  }
  return {kind:null,id:null,data:null,attempts};
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

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const number=String(req.query?.number||'').trim();
  const title=String(req.query?.title||'').trim().slice(0,300);
  if(!/^\d{4,20}$/.test(number))return res.status(400).json({ok:false,error:'invalid_number'});
  const found=await findPurchase(number,title);
  if(!found.hit)return res.status(404).json({ok:false,error:'purchase_not_found',number,probes:found.probes});
  const detail=await getDetail(found.hit);const files=filesFrom(detail.data);
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
  return res.status(200).json({ok:true,source:'АИС Портал поставщиков',number,match:compactItem(found.hit),entity:{kind:detail.kind,id:detail.id},files_count:files.length,files,detail_attempts:detail.attempts,probes:found.probes});
}
