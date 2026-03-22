/**
 * permissions.js — Verificação e solicitação de permissões do dispositivo
 *
 * Exibe um modal passo-a-passo após login para garantir que o app
 * tenha acesso a: Localização, Notificações, Câmera e Armazenamento.
 *
 * Tratamento multi-plataforma:
 *  - iOS/Safari: navigator.permissions não existe, fallback com getCurrentPosition
 *  - Android/Chrome: detecta bloqueio permanente via Permissions API
 *  - Desktop: instruções para desbloqueio via barra de endereço
 *  - PWA standalone: instruções específicas para apps instalados
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'airpet_permissions_done';
  var STORAGE_VERSION = '3';

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  var isChrome = /Chrome/i.test(navigator.userAgent) && !/Edge|Edg|OPR/i.test(navigator.userAgent);
  var isFirefox = /Firefox/i.test(navigator.userAgent);
  var isMobile = isIOS || isAndroid;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  var permissoes = [
    {
      id: 'geolocalizacao',
      nome: 'Localização',
      descricao: 'Encontrar pets e serviços perto de você.',
      icone: 'fa-location-dot',
      corIcone: 'text-blue-500',
      bgIcone: 'bg-blue-100',
      obrigatoria: true
    },
    {
      id: 'notificacoes',
      nome: 'Notificações',
      descricao: 'Receber alertas importantes em tempo real.',
      icone: 'fa-bell',
      corIcone: 'text-amber-500',
      bgIcone: 'bg-amber-100',
      obrigatoria: true
    },
    {
      id: 'camera',
      nome: 'Câmera',
      descricao: 'Tirar fotos e registrar avistamentos.',
      icone: 'fa-camera',
      corIcone: 'text-purple-500',
      bgIcone: 'bg-purple-100',
      obrigatoria: false
    },
    {
      id: 'armazenamento',
      nome: 'Armazenamento Persistente',
      descricao: 'Salvar dados para melhor desempenho offline.',
      icone: 'fa-hard-drive',
      corIcone: 'text-emerald-500',
      bgIcone: 'bg-emerald-100',
      obrigatoria: false
    }
  ];

  function jaVerificou() {
    try {
      return localStorage.getItem(STORAGE_KEY) === STORAGE_VERSION;
    } catch (e) {
      return false;
    }
  }

  function marcarVerificado() {
    try {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION);
    } catch (e) { /* sem suporte a localStorage */ }
  }

  function obrigatoriasOk(estados) {
    return permissoes.filter(function (p) { return p.obrigatoria; }).every(function (p) {
      var e = estados[p.id];
      return e === 'granted' || e === 'unsupported';
    });
  }

  /* ===================================================================
   * Detecção de status via Permissions API (quando disponível)
   * =================================================================== */

  function verificarGeolocalizacaoIOS() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve('unsupported');

      var resolvido = false;
      var timer = setTimeout(function () {
        if (!resolvido) {
          resolvido = true;
          resolve('prompt');
        }
      }, 4000);

      navigator.geolocation.getCurrentPosition(
        function () {
          if (!resolvido) {
            resolvido = true;
            clearTimeout(timer);
            resolve('granted');
          }
        },
        function (err) {
          if (!resolvido) {
            resolvido = true;
            clearTimeout(timer);
            resolve(err.code === 1 || err.code === 2 ? 'denied' : 'prompt');
          }
        },
        { enableHighAccuracy: false, timeout: 3500, maximumAge: 300000 }
      );
    });
  }

  function verificarStatusPermissao(perm) {
    return new Promise(function (resolve) {
      if (perm.id === 'geolocalizacao') {
        if (isIOS) return verificarGeolocalizacaoIOS().then(resolve);
        if (!navigator.permissions) return resolve('prompt');
        navigator.permissions.query({ name: 'geolocation' }).then(function (r) {
          resolve(r.state);
        }).catch(function () { resolve('prompt'); });

      } else if (perm.id === 'notificacoes') {
        if (!('Notification' in window)) return resolve('unsupported');
        var p = Notification.permission;
        resolve(p === 'default' ? 'prompt' : p);

      } else if (perm.id === 'camera') {
        if (!navigator.mediaDevices) return resolve('prompt');
        if (!navigator.permissions) return resolve('prompt');
        navigator.permissions.query({ name: 'camera' }).then(function (r) {
          resolve(r.state);
        }).catch(function () { resolve('prompt'); });

      } else if (perm.id === 'armazenamento') {
        if (!navigator.storage || !navigator.storage.persisted) return resolve('prompt');
        navigator.storage.persisted().then(function (ok) {
          resolve(ok ? 'granted' : 'prompt');
        }).catch(function () { resolve('prompt'); });

      } else {
        resolve('prompt');
      }
    });
  }

  /* ===================================================================
   * Solicitação real de permissão (chama a API nativa do browser)
   * =================================================================== */

  function solicitarPermissao(perm, estados) {
    return new Promise(function (resolve) {
      var estadoAtual = estados ? estados[perm.id] : null;

      if (perm.id === 'geolocalizacao') {
        if (!navigator.geolocation) return resolve('denied');

        if (estadoAtual === 'denied' && !isIOS) {
          return verificarStatusPermissao(perm).then(function (real) {
            if (real === 'denied') return resolve('denied');
            pedirGeo(resolve);
          });
        }
        pedirGeo(resolve);

      } else if (perm.id === 'notificacoes') {
        if (!('Notification' in window)) return resolve('unsupported');

        if (estadoAtual === 'denied' && Notification.permission === 'denied') {
          return resolve('denied');
        }

        Notification.requestPermission().then(function (result) {
          resolve(result === 'default' ? 'prompt' : result);
        }).catch(function () { resolve('denied'); });

      } else if (perm.id === 'camera') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return resolve('denied');

        if (estadoAtual === 'denied') {
          return verificarStatusPermissao(perm).then(function (real) {
            if (real === 'denied') return resolve('denied');
            pedirCamera(resolve);
          });
        }
        pedirCamera(resolve);

      } else if (perm.id === 'armazenamento') {
        if (!navigator.storage || !navigator.storage.persist) return resolve('denied');
        navigator.storage.persist().then(function (ok) {
          resolve(ok ? 'granted' : 'denied');
        }).catch(function () { resolve('denied'); });

      } else {
        resolve('denied');
      }
    });
  }

  function pedirGeo(resolve) {
    navigator.geolocation.getCurrentPosition(
      function () { resolve('granted'); },
      function (err) {
        console.warn('[AIRPET] Geolocation error:', err.code, err.message);
        if (err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            function () { resolve('granted'); },
            function (err2) {
              resolve(err2.code === 1 || err2.code === 2 ? 'denied' : 'prompt');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
          );
          return;
        }
        resolve(err.code === 1 || err.code === 2 ? 'denied' : 'prompt');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function pedirCamera(resolve) {
    navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      resolve('granted');
    }).catch(function (err) {
      resolve(err.name === 'NotAllowedError' ? 'denied' : 'prompt');
    });
  }

  var deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    marcarVerificado();
  });

  /* ===================================================================
   * Modal UI
   * =================================================================== */

  function criarModalBase() {
    var overlay = document.createElement('div');
    overlay.id = 'airpet-permissions-overlay';
    overlay.className = 'airpet-perm-overlay';

    var modal = document.createElement('div');
    modal.id = 'airpet-permissions-modal';
    modal.className = 'airpet-perm-modal';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      modal.style.transform = 'translateY(0)';
    });

    return { overlay: overlay, modal: modal };
  }

  function renderizarListaPwa(estados) {
    var container = document.getElementById('airpet-perm-lista');
    var progressContainer = document.getElementById('airpet-perm-progress');
    if (!container) return;

    var html = '';
    var concedidas = 0;

    permissoes.forEach(function (perm, i) {
      var estado = estados[perm.id] || 'prompt';
      var isGranted = estado === 'granted';
      var isDenied = estado === 'denied';
      var isUnsupported = estado === 'unsupported';

      if (isGranted) concedidas++;

      var statusHtml;
      if (isGranted) {
        statusHtml = '<span class="airpet-badge airpet-badge-status-ok"><i class="fa-solid fa-circle-check"></i>Ativo</span>';
      } else if (isDenied) {
        statusHtml =
          '<button data-perm-id="' + perm.id + '" data-perm-idx="' + i + '" class="airpet-perm-retry-btn airpet-perm-btn airpet-perm-btn-retry">' +
            '<i class="fa-solid fa-rotate-right" style="margin-right:3px;"></i>Tentar' +
          '</button>';
      } else if (isUnsupported) {
        statusHtml = '<span class="airpet-badge airpet-badge-status-off"><i class="fa-solid fa-circle-minus"></i>Indisponível</span>';
      } else {
        statusHtml = '<button data-perm-id="' + perm.id + '" data-perm-idx="' + i + '" class="airpet-perm-allow-btn airpet-perm-btn airpet-perm-btn-allow">Permitir</button>';
      }

      html += '' +
        '<div class="airpet-perm-card">' +
          '<div class="airpet-perm-card-top">' +
            '<div class="airpet-perm-icon-wrap ' + perm.bgIcone + '">' +
              '<i class="fa-solid ' + perm.icone + ' ' + perm.corIcone + '" style="font-size:18px;"></i>' +
            '</div>' +
            '<div class="airpet-perm-content">' +
              '<div class="airpet-perm-headline">' +
                '<span class="airpet-perm-name">' + perm.nome + '</span>' +
                (perm.obrigatoria ? '<span class="airpet-badge airpet-badge-required">Necessário</span>' : '') +
              '</div>' +
              '<p class="airpet-perm-desc">' + perm.descricao + '</p>' +
            '</div>' +
            '<div class="airpet-perm-actions">' + statusHtml + '</div>' +
          '</div>' +
        '</div>';
    });

    container.innerHTML = html;

    var progressHtml = '';
    permissoes.forEach(function (perm) {
      var estado = estados[perm.id] || 'prompt';
      var classes = 'airpet-perm-progress-step';
      if (estado === 'granted') classes += ' is-ok';
      if (estado === 'denied') classes += ' is-blocked';
      progressHtml += '<div class="' + classes + '"></div>';
    });
    progressContainer.innerHTML = progressHtml;

    var btnPrincipal = document.getElementById('airpet-perm-btn-principal');
    btnPrincipal.removeAttribute('data-action');
    btnPrincipal.removeAttribute('data-tone');

    if (concedidas === permissoes.length) {
      btnPrincipal.textContent = 'Tudo Pronto!';
      btnPrincipal.setAttribute('data-tone', 'success');
    } else {
      var pendentes = permissoes.filter(function (p) {
        var e = estados[p.id] || 'prompt';
        return e !== 'granted' && e !== 'denied' && e !== 'unsupported';
      });
      var bloqueadas = permissoes.filter(function (p) {
        return estados[p.id] === 'denied';
      });

      if (pendentes.length > 0) {
        btnPrincipal.textContent = 'Permitir tudo (' + pendentes.length + ')';
      } else if (bloqueadas.length > 0) {
        btnPrincipal.textContent = 'Continuar';
        btnPrincipal.setAttribute('data-tone', 'info');
      } else {
        btnPrincipal.textContent = 'Continuar';
      }
    }

    bindBotoesPermissao(container, estados);
  }

  function bindBotoesPermissao(container, estados) {
    container.querySelectorAll('.airpet-perm-allow-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var permId = btn.getAttribute('data-perm-id');
        var perm = permissoes.find(function (p) { return p.id === permId; });
        if (!perm) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:3px;"></i>Aguarde...';

        solicitarPermissao(perm, estados).then(function (resultado) {
          estados[perm.id] = resultado;
          renderizarListaPwa(estados);
        });
      });
    });

    container.querySelectorAll('.airpet-perm-retry-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var permId = btn.getAttribute('data-perm-id');
        var perm = permissoes.find(function (p) { return p.id === permId; });
        if (!perm) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:3px;"></i>Verificando...';

        verificarStatusPermissao(perm).then(function (statusReal) {
          if (statusReal === 'granted') {
            estados[perm.id] = 'granted';
            renderizarListaPwa(estados);
            return;
          }

          if (statusReal === 'prompt') {
            solicitarPermissao(perm, estados).then(function (resultado) {
              estados[perm.id] = resultado;
              renderizarListaPwa(estados);
            });
            return;
          }

          estados[perm.id] = 'denied';
          renderizarListaPwa(estados);
        });
      });
    });
  }

  function fecharModal(elements, estados, forcar) {
    if (!elements) return;

    if (!forcar && !obrigatoriasOk(estados)) {
      marcarVerificadoParcial();
    } else {
      marcarVerificado();
    }

    elements.overlay.style.opacity = '0';
    elements.modal.style.transform = 'translateY(20px)';
    setTimeout(function () {
      if (elements.overlay.parentNode) {
        elements.overlay.parentNode.removeChild(elements.overlay);
      }
    }, 300);
  }

  function marcarVerificadoParcial() {
    /* Não marca como verificado — o modal aparecerá no próximo login */
  }

  function mostrarFallbackInstalacao() {
    var msg = 'Para instalar o AIRPET:\n\n';
    if (isIOS) {
      msg += 'Abra o menu Compartilhar do Safari e toque em "Adicionar a Tela de Início".';
    } else if (isAndroid || isChrome) {
      msg += 'Abra o menu do navegador e toque em "Instalar app" ou "Adicionar à tela inicial".';
    } else {
      msg += 'No seu navegador, procure por "Instalar app" na barra de endereço ou menu.';
    }
    alert(msg);
  }

  function criarConteudoInstalacaoWeb() {
    return '' +
      '<div class="airpet-perm-header">' +
        '<div class="airpet-perm-header-icon"><i class="fa-solid fa-mobile-screen-button" style="font-size:28px;"></i></div>' +
        '<h2 class="airpet-perm-title">Instale o AIRPET</h2>' +
        '<p class="airpet-perm-subtitle">A melhor experiência acontece no app instalado. É rápido e gratuito.</p>' +
      '</div>' +
      '<div class="airpet-perm-list">' +
        '<div class="airpet-install-card">' +
          '<p class="airpet-install-text">Instale agora para ativar notificações e usar recursos completos.</p>' +
        '</div>' +
      '</div>' +
      '<div class="airpet-perm-footer">' +
        '<button id="airpet-install-btn-principal" class="airpet-main-action">Instalar app</button>' +
        '<button id="airpet-install-btn-pular" class="airpet-secondary-action">Continuar na web</button>' +
      '</div>';
  }

  function criarConteudoPermissoesPwa() {
    var plataformaNotice = '';
    if (isIOS) {
      plataformaNotice = '<div class="airpet-platform-notice"><i class="fa-brands fa-apple"></i><span>Você está no app instalado. Autorize para continuar.</span></div>';
    } else if (isAndroid) {
      plataformaNotice = '<div class="airpet-platform-notice"><i class="fa-brands fa-android"></i><span>Você está no app instalado. Autorize para continuar.</span></div>';
    }

    return '' +
      '<div class="airpet-perm-header">' +
        '<div class="airpet-perm-header-icon"><i class="fa-solid fa-shield-check" style="font-size:28px;"></i></div>' +
        '<h2 class="airpet-perm-title">Ativar permissões</h2>' +
        '<p class="airpet-perm-subtitle">Falta pouco. Toque em permitir para liberar todos os recursos.</p>' +
      '</div>' +
      plataformaNotice +
      '<div id="airpet-perm-lista" class="airpet-perm-list"></div>' +
      '<div class="airpet-perm-footer">' +
        '<div id="airpet-perm-progress" class="airpet-perm-progress"></div>' +
        '<button id="airpet-perm-btn-principal" class="airpet-main-action">Permitir tudo</button>' +
        '<button id="airpet-perm-btn-pular" class="airpet-secondary-action">Agora não</button>' +
      '</div>';
  }

  function abrirFluxoInstalacaoWeb() {
    var elements = criarModalBase();
    elements.modal.innerHTML = criarConteudoInstalacaoWeb();

    document.getElementById('airpet-install-btn-principal').addEventListener('click', function () {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(function () {
          deferredInstallPrompt = null;
        });
      } else {
        mostrarFallbackInstalacao();
      }
    });

    document.getElementById('airpet-install-btn-pular').addEventListener('click', function () {
      fecharModal(elements, {}, false);
    });

    elements.overlay.addEventListener('click', function (e) {
      if (e.target === elements.overlay) fecharModal(elements, {}, false);
    });
  }

  function abrirFluxoPermissoesPwa(estados) {
    var elements = criarModalBase();
    elements.modal.innerHTML = criarConteudoPermissoesPwa();
    renderizarListaPwa(estados);

    document.getElementById('airpet-perm-btn-principal').addEventListener('click', function () {
      var pendentes = permissoes.filter(function (p) {
        var e = estados[p.id] || 'prompt';
        return e !== 'granted' && e !== 'denied' && e !== 'unsupported';
      });

      if (pendentes.length === 0) {
        fecharModal(elements, estados, false);
        return;
      }

      var btn = document.getElementById('airpet-perm-btn-principal');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Solicitando...';

      var idx = 0;
      function proximaPermissao() {
        if (idx >= pendentes.length) {
          btn.disabled = false;
          renderizarListaPwa(estados);
          var todasOk = permissoes.every(function (p) {
            return estados[p.id] === 'granted' || estados[p.id] === 'unsupported';
          });
          if (todasOk) setTimeout(function () { fecharModal(elements, estados, true); }, 300);
          return;
        }

        solicitarPermissao(pendentes[idx], estados).then(function (resultado) {
          estados[pendentes[idx].id] = resultado;
          renderizarListaPwa(estados);
          idx++;
          setTimeout(proximaPermissao, 200);
        });
      }
      proximaPermissao();
    });

    document.getElementById('airpet-perm-btn-pular').addEventListener('click', function () {
      fecharModal(elements, estados, false);
    });

    elements.overlay.addEventListener('click', function (e) {
      if (e.target === elements.overlay) fecharModal(elements, estados, false);
    });
  }

  /* ===================================================================
   * Inicialização
   * =================================================================== */

  function iniciar() {
    var isLogado = document.body.getAttribute('data-logado') === 'true';
    if (!isLogado) return;

    var loginFresco = document.body.getAttribute('data-verificar-permissoes') === 'true';
    if (loginFresco) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ok */ }
    }

    if (jaVerificou()) return;

    var estados = {};
    var checks = permissoes.map(function (perm) {
      return verificarStatusPermissao(perm).then(function (status) {
        estados[perm.id] = status;
      });
    });

    Promise.all(checks).then(function () {
      var todasConcedidas = permissoes.every(function (p) {
        return estados[p.id] === 'granted';
      });

      if (todasConcedidas) {
        marcarVerificado();
        return;
      }

      setTimeout(function () {
        if (!isStandalone) {
          abrirFluxoInstalacaoWeb();
          return;
        }
        abrirFluxoPermissoesPwa(estados);
      }, 600);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  window.airpetPermissions = {
    resetar: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ok */ }
    },
    verificar: iniciar,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isStandalone: isStandalone
  };
})();
