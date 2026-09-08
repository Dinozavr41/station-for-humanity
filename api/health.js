export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({
    ok:true,
    service:'station-for-humanity',
    version:'alpha-0.3-control',
    environment:process.env.VERCEL_ENV||'unknown',
    time:new Date().toISOString()
  });
}
