function geoValidationMiddleware(req, res, next) {
  const { latitude, longitude } = req.body || {};
  // #region agent log
  fetch('http://127.0.0.1:7619/ingest/ae098eda-cae8-4273-b296-012a1e446933',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f331f'},body:JSON.stringify({sessionId:'8f331f',runId:'partner-debug',hypothesisId:'H2',location:'geoValidationMiddleware.js:entry',message:'Geo middleware entry',data:{hasLatitude:latitude!==undefined&&latitude!==null&&String(latitude)!=='',hasLongitude:longitude!==undefined&&longitude!==null&&String(longitude)!==''},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (latitude === undefined || longitude === undefined) return next();

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  // #region agent log
  fetch('http://127.0.0.1:7619/ingest/ae098eda-cae8-4273-b296-012a1e446933',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f331f'},body:JSON.stringify({sessionId:'8f331f',runId:'partner-debug',hypothesisId:'H2',location:'geoValidationMiddleware.js:parsed',message:'Geo middleware parsed coords',data:{latIsFinite:Number.isFinite(lat),lngIsFinite:Number.isFinite(lng),lat, lng},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    req.session.flash = {
      tipo: 'erro',
      mensagem: 'Localização inválida. Use o botão de localização atual ou busque o endereço no mapa.',
    };
    return res.redirect('back');
  }

  req.body.latitude = lat;
  req.body.longitude = lng;
  return next();
}

module.exports = { geoValidationMiddleware };
