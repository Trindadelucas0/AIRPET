function geoValidationMiddleware(req, res, next) {
  const { latitude, longitude } = req.body || {};
  if (latitude === undefined || longitude === undefined) return next();

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
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
