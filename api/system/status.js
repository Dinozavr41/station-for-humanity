export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const configured={
    database:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),
    paymentSandbox:Boolean(process.env.YOOKASSA_SHOP_ID&&process.env.YOOKASSA_SECRET_KEY),
    paymentsEnabled:process.env.PAYMENTS_ENABLED==='true',
    payoutsEnabled:process.env.PAYOUTS_ENABLED==='true'
  };
  res.status(200).json({
    service:'station-for-humanity',
    mode:configured.paymentsEnabled?'live-or-test-enabled':'safe-disabled',
    configured,
    note:'This endpoint never returns credentials.'
  });
}
