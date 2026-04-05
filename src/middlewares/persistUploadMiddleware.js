/**
 * Após multer.memoryStorage(), grava via storageService e define storagePublicUrl em cada ficheiro.
 */

const path = require('path');
const storageService = require('../services/storageService');
const logger = require('../utils/logger');

function persistSingle(folder) {
  return async (req, res, next) => {
    try {
      if (req.file && req.file.buffer) {
        const { publicUrl } = await storageService.saveBuffer({
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
          folder,
        });
        req.file.storagePublicUrl = publicUrl;
      }
      next();
    } catch (e) {
      logger.error('STORAGE', 'persistSingle', e);
      next(e);
    }
  };
}

function persistArray(folder) {
  return async (req, res, next) => {
    try {
      const files = req.files;
      if (Array.isArray(files)) {
        for (const f of files) {
          if (f && f.buffer) {
            const { publicUrl } = await storageService.saveBuffer({
              buffer: f.buffer,
              mimetype: f.mimetype,
              originalname: f.originalname,
              folder,
            });
            f.storagePublicUrl = publicUrl;
          }
        }
      }
      next();
    } catch (e) {
      logger.error('STORAGE', 'persistArray', e);
      next(e);
    }
  };
}

/** fieldFolderMap: { foto_perfil: 'perfil', foto_capa: 'capa' } */
function persistFields(fieldFolderMap) {
  return async (req, res, next) => {
    try {
      const files = req.files || {};
      for (const [field, folder] of Object.entries(fieldFolderMap)) {
        const arr = files[field];
        if (!arr || !arr[0] || !arr[0].buffer) continue;
        const f = arr[0];
        const { publicUrl } = await storageService.saveBuffer({
          buffer: f.buffer,
          mimetype: f.mimetype,
          originalname: f.originalname,
          folder,
        });
        f.storagePublicUrl = publicUrl;
      }
      next();
    } catch (e) {
      logger.error('STORAGE', 'persistFields', e);
      next(e);
    }
  };
}

/** Logo + galeria do formulário público de parceiros */
async function persistPartnerPetshopUploads(req, res, next) {
  try {
    const files = req.files || {};
    if (files.logo && files.logo[0] && files.logo[0].buffer) {
      const f = files.logo[0];
      const { publicUrl } = await storageService.saveBuffer({
        buffer: f.buffer,
        mimetype: f.mimetype,
        originalname: f.originalname,
        folder: 'petshops',
      });
      f.storagePublicUrl = publicUrl;
    }
    if (Array.isArray(files.fotos)) {
      for (const f of files.fotos) {
        if (f && f.buffer) {
          const { publicUrl } = await storageService.saveBuffer({
            buffer: f.buffer,
            mimetype: f.mimetype,
            originalname: f.originalname,
            folder: 'petshops',
          });
          f.storagePublicUrl = publicUrl;
        }
      }
    }
    next();
  } catch (e) {
    logger.error('STORAGE', 'persistPartnerPetshopUploads', e);
    next(e);
  }
}

/** Ícones PWA admin: nomes fixos icon-192 / icon-512 */
function persistPwaIcons() {
  return async (req, res, next) => {
    try {
      const files = req.files || {};
      for (const field of ['icon_192', 'icon_512']) {
        const arr = files[field];
        if (!arr || !arr[0] || !arr[0].buffer) continue;
        const f = arr[0];
        const rawExt = (path.extname(f.originalname || '') || '.png').toLowerCase();
        const ext = rawExt === '.svg' ? '.svg' : '.png';
        const base = field === 'icon_192' ? 'icon-192' : 'icon-512';
        const filename = base + ext;
        const { publicUrl } = await storageService.saveBuffer({
          buffer: f.buffer,
          mimetype: f.mimetype,
          originalname: f.originalname,
          folder: 'pwa',
          filename,
        });
        f.storagePublicUrl = publicUrl;
        f.savedBasename = filename;
      }
      next();
    } catch (e) {
      logger.error('STORAGE', 'persistPwaIcons', e);
      next(e);
    }
  };
}

/** URL para persistir no DB a partir de ficheiro multer em memória */
function multerPublicUrl(file, legacyFolder) {
  if (!file) return null;
  if (file.storagePublicUrl) return file.storagePublicUrl;
  if (file.filename && legacyFolder) return `/images/${legacyFolder}/${file.filename}`.replace(/\/+/g, '/');
  return null;
}

module.exports = {
  persistSingle,
  persistArray,
  persistFields,
  persistPartnerPetshopUploads,
  persistPwaIcons,
  multerPublicUrl,
};
