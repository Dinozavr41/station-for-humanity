import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
let catalog=null;
let estimateTimer=null;

const money=(n,c='RUB')=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c,maximumFractionDigits:0}).format(Number(n||0));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function setEngineState(ok,text){
  const el=$('#pricingEngineState');
  if(!el)return;
  el.textContent=text;
  el.dataset.state=ok?'ok':'error';
}

async function call(body){
  const run=async()=>{
    const {data,error}=await sb.functions.invoke('digital-factory-quote',{body});
    if(error){
      let message=error.message||'Pricing Engine недоступен';
      try{if(error.context){const j=await error.context.json();message=j?.detail||j?.error||message}}catch{}
      throw new Error(message);
    }
    if(!data?.ok)throw new Error(data?.detail||data?.error||'factory_service_error');
    return data;
  };
  try{return await run()}catch(first){
    await new Promise(r=>setTimeout(r,450));
    try{return await run()}catch{throw first}
  }
}

function renderOptions(){
  const box=$('#options');
  box.innerHTML='';
  for(const rule of catalog.rules){
    const article=document.createElement('article');article.className='option';
    const info=document.createElement('div');
    info.innerHTML=`<h3>${esc(rule.label_ru)}</h3><p>${rule.input_kind==='quantity'?`до ${rule.max_quantity} шт.`:'добавить к базовому пакету'}</p>`;
    const control=document.createElement('div');control.className='option-control';
    const price=document.createElement('span');price.className='option-price';price.textContent=`+ ${money(rule.unit_price,catalog.product.currency)}${rule.input_kind==='quantity'?' / шт.':''}`;
    let input;
    if(rule.input_kind==='quantity'){
      input=document.createElement('input');input.type='number';input.min='0';input.max=String(rule.max_quantity);input.step='1';input.value='0';
    }else{
      input=document.createElement('input');input.type='checkbox';
    }
    input.dataset.option=rule.option_code;input.dataset.kind=rule.input_kind;input.addEventListener('change',queueEstimate);input.addEventListener('input',queueEstimate);
    control.append(price,input);article.append(info,control);box.append(article);
  }
}

function collectOptions(){const out={};document.querySelectorAll('[data-option]').forEach(i=>{out[i.dataset.option]=i.dataset.kind==='boolean'?i.checked:Number(i.value||0)});return out;}
function queueEstimate(){clearTimeout(estimateTimer);estimateTimer=setTimeout(refreshEstimate,120)}
async function refreshEstimate(){
  try{
    const d=await call({action:'estimate',options:collectOptions()});renderEstimate(d.quote);setEngineState(true,'PRICING ENGINE LIVE');
  }catch(e){$('#estimatePrice').textContent='Ошибка';$('#estimateTime').textContent=e.message;setEngineState(false,'PRICING ENGINE ERROR');}
}
function renderEstimate(q){
  $('#estimatePrice').textContent=money(q.amount,q.currency);
  $('#estimateTime').textContent=`Срок: ${q.delivery_days} ${q.delivery_days===1?'рабочий день':q.delivery_days<5?'рабочих дня':'рабочих дней'} · версия цены ${q.price_version}`;
  $('#breakdown').innerHTML=(q.breakdown||[]).map(x=>`<div class="break-row"><span>${esc(x.label_ru)}${x.qty>1?` × ${x.qty}`:''}</span><span>${money(x.subtotal,q.currency)}</span></div>`).join('');
}

async function init(){
  setEngineState(true,'PRICING ENGINE · CONNECTING');
  try{
    const d=await call({action:'catalog'});catalog=d;
    $('#basePrice').textContent=money(d.product.base_price,d.product.currency);
    const productName=$('#productName');if(productName)productName.textContent=d.product.name_ru;
    const productDescription=$('#productDescription');if(productDescription)productDescription.textContent=d.product.public_description_ru||'';
    renderOptions();await refreshEstimate();setEngineState(true,'PRICING ENGINE LIVE');
  }catch(e){
    $('#options').innerHTML=`<div class="loading">Pricing Engine недоступен: ${esc(e.message)}<br><button id="retryPricing" class="btn" type="button" style="margin-top:14px">Повторить подключение</button></div>`;
    $('#estimatePrice').textContent='—';setEngineState(false,'PRICING ENGINE ERROR');
    $('#retryPricing')?.addEventListener('click',init);
  }
}

const errors={customer_name_required:'Укажите имя или компанию.',contact_required:'Оставьте способ связи.',desired_result_too_short:'Опишите результат чуть подробнее — минимум 10 символов.',consent_required:'Нужно согласие на обработку заявки.',rate_limit_exceeded:'Слишком много заявок с одного адреса. Попробуйте позже.'};
$('#orderForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!catalog){$('#formStatus').textContent='Сначала восстановите подключение к Pricing Engine.';return}
  const btn=$('#submitBtn'),status=$('#formStatus');btn.disabled=true;status.textContent='Сервер считает и фиксирует Quote…';
  try{
    const d=await call({action:'submit',customer_name:$('#customerName').value,contact:$('#contact').value,business_type:$('#businessType').value,desired_result:$('#desiredResult').value,options:collectOptions(),consent:$('#consent').checked,website:$('#website').value});
    const r=d.request;status.textContent='Готово.';
    const s=$('#success');s.hidden=false;s.innerHTML=`<p class="eyebrow">QUOTE CREATED</p><h3>Заявка принята. Цена зафиксирована.</h3><p>Station создала коммерческую заявку, заказ и Quote. Живое списание пока намеренно отключено: сначала подтверждаем контакт и готовность к производству.</p><div class="success-grid"><div><small>REQUEST</small><strong>${esc(r.number)}</strong></div><div><small>ORDER</small><strong>${esc(r.order_number)}</strong></div><div><small>QUOTE</small><strong>${esc(r.quote_number)}</strong></div><div><small>AMOUNT</small><strong>${money(r.amount,r.currency)}</strong></div></div><p>${esc(d.message_ru||'')}</p>`;
    s.scrollIntoView({behavior:'smooth',block:'center'});
  }catch(e){status.textContent=errors[e.message]||`Ошибка: ${e.message}`;}
  finally{btn.disabled=false;}
});

init();