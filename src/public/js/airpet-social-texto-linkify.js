/**
 * Alinhado a src/models/Hashtag.js: slug + regex de hashtags no texto já escapado em HTML.
 */
(function (global) {
  'use strict';

  var ACCENT_MAP = {
    á: 'a',
    à: 'a',
    â: 'a',
    ã: 'a',
    ä: 'a',
    å: 'a',
    é: 'e',
    è: 'e',
    ê: 'e',
    ë: 'e',
    í: 'i',
    ì: 'i',
    î: 'i',
    ï: 'i',
    ó: 'o',
    ò: 'o',
    ô: 'o',
    õ: 'o',
    ö: 'o',
    ú: 'u',
    ù: 'u',
    û: 'u',
    ü: 'u',
    ç: 'c',
    ñ: 'n',
  };

  function slugifyTag(raw) {
    var s = String(raw || '')
      .toLowerCase()
      .trim();
    if (!s) return '';
    var out = '';
    for (var i = 0; i < s.length; i += 1) {
      var c = s.charAt(i);
      out += ACCENT_MAP[c] || c;
    }
    s = out.replace(/[^a-z0-9_]+/g, '');
    return s.length > 50 ? s.slice(0, 50) : s;
  }

  var HASHTAG_BODY = '([a-zA-Z0-9_\\u00C0-\\u017F]{2,50})';
  var HASHTAG_RE = new RegExp('#' + HASHTAG_BODY, 'g');

  function linkifyHashtagsInEscaped(esc) {
    var html = String(esc || '');
    return html.replace(HASHTAG_RE, function (full, cap) {
      var slug = slugifyTag(cap);
      if (slug.length < 2) return full;
      return (
        '<a class="hashtag text-primary-600 hover:underline font-medium" href="/h/' +
        encodeURIComponent(slug) +
        '">' +
        full +
        '</a>'
      );
    });
  }

  global.AIRPET_socialTextoLinkify = {
    slugifyTag: slugifyTag,
    linkifyHashtagsInEscaped: linkifyHashtagsInEscaped,
  };
})(typeof window !== 'undefined' ? window : this);
