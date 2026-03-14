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
      descricao: isIOS
        ? 'Precisamos da sua localização. No iPhone, verifique se os Serviços de Localização estão ativados em Ajustes.'
        : 'Precisamos da sua localização para encontrar pets perdidos perto de você, exibir petshops e pontos no mapa.',
      icone: 'fa-location-dot',
      corIcone: 'text-blue-500',
      bgIcone: 'bg-blue-100',
      obrigatoria: true
    },
    {
      id: 'notificacoes',
      nome: 'Notificações',
      descricao: 'Receba alertas em tempo real quando um pet perdido for avistado perto de você ou quando houver novidades.',
      icone: 'fa-bell',
      corIcone: 'text-amber-500',
      bgIcone: 'bg-amber-100',
      obrigatoria: true
    },
    {
      id: 'camera',
      nome: 'Câmera',
      descricao: 'Use a câmera para tirar fotos do seu pet, escanear tags NFC e registrar avistamentos.',
      icone: 'fa-camera',
      corIcone: 'text-purple-500',
      bgIcone: 'bg-purple-100',
      obrigatoria: false
    },
    {
      id: 'armazenamento',
      nome: 'Armazenamento Persistente',
      descricao: 'Permite que o app funcione offline e guarde dados importantes mesmo com pouca memória no dispositivo.',
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

  /* ===================================================================
   * Instruções de desbloqueio por plataforma
   * =================================================================== */

  function getInstrucoesBloqueio(permId) {
    if (isIOS) return getInstrucoesIOS(permId);
    if (isAndroid) return getInstrucoesAndroid(permId);
    return getInstrucoesDesktop(permId);
  }

  function getInstrucoesIOS(permId) {
    if (permId === 'geolocalizacao') {
      if (isStandalone) {
        return caixaInstrucoes('⚙️ Como ativar no iPhone:', [
          'Abra <strong>Ajustes</strong> do iPhone',
          'Toque em <strong>Privacidade e Segurança</strong>',
          'Toque em <strong>Serviços de Localização</strong>',
          'Verifique se está <strong>Ativado</strong> (verde)',
          'Role até <strong>Safari</strong> e toque nele',
          'Selecione <strong>"Ao Usar o App"</strong>',
          'Volte aqui e toque em <strong>Tentar Novamente</strong>'
        ]);
      }
      return caixaInstrucoes('⚙️ Como ativar no iPhone:', [
        'Abra <strong>Ajustes</strong> do iPhone',
        'Role até <strong>Safari</strong> e toque',
        'Em <strong>Ajustes de Sites</strong>, toque em <strong>Localização</strong>',
        'Selecione <strong>"Permitir"</strong> ou <strong>"Perguntar"</strong>',
        'Volte ao AIRPET e recarregue a página'
      ]);
    }
    if (permId === 'notificacoes') {
      return caixaAviso('⚠️ No iOS, as notificações push só funcionam se o AIRPET estiver instalado na tela inicial (PWA). Adicione o app via botão "Compartilhar → Adicionar à Tela de Início".');
    }
    if (permId === 'camera') {
      return caixaInstrucoes('⚙️ Como ativar a câmera no iPhone:', [
        'Abra <strong>Ajustes</strong> do iPhone',
        'Role até <strong>Safari</strong> e toque',
        'Em <strong>Ajustes de Sites</strong>, toque em <strong>Câmera</strong>',
        'Selecione <strong>"Permitir"</strong> ou <strong>"Perguntar"</strong>',
        'Volte ao AIRPET e recarregue a página'
      ]);
    }
    return '';
  }

  function getInstrucoesAndroid(permId) {
    var nomePermissao = '';
    if (permId === 'geolocalizacao') nomePermissao = 'Localização';
    else if (permId === 'notificacoes') nomePermissao = 'Notificações';
    else if (permId === 'camera') nomePermissao = 'Câmera';
    else return '';

    if (isStandalone) {
      return caixaInstrucoes('⚙️ Como ativar no Android:', [
        'Abra as <strong>Configurações</strong> do Android',
        'Vá em <strong>Apps</strong> ou <strong>Aplicativos</strong>',
        'Encontre o <strong>AIRPET</strong> (ou Chrome)',
        'Toque em <strong>Permissões</strong>',
        'Ative <strong>' + nomePermissao + '</strong>',
        'Volte ao app e toque em <strong>Tentar Novamente</strong>'
      ]);
    }

    return caixaInstrucoes('⚙️ Como ativar no Android/Chrome:', [
      'Toque no <strong>ícone de cadeado 🔒</strong> (ou ⓘ) na barra de endereço',
      'Toque em <strong>Permissões</strong> ou <strong>Configurações do site</strong>',
      'Ative <strong>' + nomePermissao + '</strong>',
      'A página irá recarregar automaticamente'
    ]);
  }

  function getInstrucoesDesktop(permId) {
    var nomePermissao = '';
    if (permId === 'geolocalizacao') nomePermissao = 'Localização';
    else if (permId === 'notificacoes') nomePermissao = 'Notificações';
    else if (permId === 'camera') nomePermissao = 'Câmera';
    else return '';

    if (isFirefox) {
      return caixaInstrucoes('⚙️ Como ativar no Firefox:', [
        'Clique no <strong>ícone de cadeado 🔒</strong> na barra de endereço',
        'Clique em <strong>Limpar permissões</strong> ou <strong>Mais informações</strong>',
        'Na aba <strong>Permissões</strong>, ajuste <strong>' + nomePermissao + '</strong>',
        'Recarregue a página'
      ]);
    }

    return caixaInstrucoes('⚙️ Como ativar no navegador:', [
      'Clique no <strong>ícone de cadeado 🔒</strong> (ou ⓘ) ao lado da URL',
      'Clique em <strong>Configurações do site</strong>',
      'Altere <strong>' + nomePermissao + '</strong> para <strong>"Permitir"</strong>',
      'A página irá recarregar automaticamente'
    ]);
  }

  function caixaInstrucoes(titulo, passos) {
    var html = '<div style="margin-top:8px;padding:10px 12px;background:#fef3c7;border-radius:10px;border:1px solid #fde68a;">' +
      '<p style="font-size:12px;font-weight:700;color:#92400e;margin:0 0 6px;">' + titulo + '</p>' +
      '<ol style="font-size:11px;color:#78350f;margin:0;padding-left:18px;line-height:1.6;">';
    passos.forEach(function (p) {
      html += '<li>' + p + '</li>';
    });
    html += '</ol></div>';
    return html;
  }

  function caixaAviso(texto) {
    return '<div style="margin-top:8px;padding:10px 12px;background:#fef3c7;border-radius:10px;border:1px solid #fde68a;">' +
      '<p style="font-size:11px;color:#92400e;margin:0;">' + texto + '</p></div>';
  }

  /* ===================================================================
   * Modal UI
   * =================================================================== */

  function criarModal() {
    var overlay = document.createElement('div');
    overlay.id = 'airpet-permissions-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);opacity:0;transition:opacity 0.3s ease;';

    var modal = document.createElement('div');
    modal.id = 'airpet-permissions-modal';
    modal.style.cssText = 'background:#fff;border-radius:20px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);transform:translateY(20px);transition:transform 0.3s ease;-webkit-overflow-scrolling:touch;';

    var plataformaNotice = '';
    if (isIOS) {
      plataformaNotice = '<div style="background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:10px 24px;text-align:center;">' +
        '<p style="font-size:12px;color:#1e40af;margin:0;">' +
          '<i class="fa-brands fa-apple" style="margin-right:4px;"></i> ' +
          'iPhone detectado — talvez seja necessário ativar permissões nos <strong>Ajustes</strong> do iOS.' +
        '</p></div>';
    } else if (isAndroid) {
      plataformaNotice = '<div style="background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:10px 24px;text-align:center;">' +
        '<p style="font-size:12px;color:#1e40af;margin:0;">' +
          '<i class="fa-brands fa-android" style="margin-right:4px;"></i> ' +
          'Se uma permissão aparecer como <strong>Bloqueada</strong>, siga as instruções para reativá-la.' +
        '</p></div>';
    }

    var header = '' +
      '<div style="background:linear-gradient(135deg,#ec5a1c 0%,#d4500f 100%);border-radius:20px 20px 0 0;padding:28px 24px 24px;text-align:center;color:#fff;">' +
        '<div style="width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">' +
          '<i class="fa-solid fa-shield-check" style="font-size:28px;"></i>' +
        '</div>' +
        '<h2 style="font-size:20px;font-weight:800;margin:0 0 6px;">Configurar Permissões</h2>' +
        '<p style="font-size:13px;opacity:0.85;margin:0;line-height:1.4;">Para o AIRPET funcionar perfeitamente, precisamos de algumas permissões do seu dispositivo.</p>' +
      '</div>';

    var lista = '<div id="airpet-perm-lista" style="padding:20px 24px 8px;"></div>';

    var footer = '' +
      '<div style="padding:8px 24px 24px;text-align:center;">' +
        '<div id="airpet-perm-progress" style="display:flex;gap:6px;justify-content:center;margin-bottom:16px;"></div>' +
        '<button id="airpet-perm-btn-principal" style="width:100%;padding:14px;border:none;border-radius:12px;background:#ec5a1c;color:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:background 0.2s;-webkit-tap-highlight-color:transparent;">Permitir Tudo</button>' +
        '<button id="airpet-perm-btn-pular" style="width:100%;margin-top:8px;padding:10px;border:none;background:transparent;color:#9ca3af;font-size:13px;cursor:pointer;transition:color 0.2s;">Configurar depois</button>' +
      '</div>';

    modal.innerHTML = header + plataformaNotice + lista + footer;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      modal.style.transform = 'translateY(0)';
    });

    return { overlay: overlay, modal: modal };
  }

  function renderizarLista(estados) {
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
        statusHtml = '<span style="color:#10b981;font-size:13px;font-weight:600;"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i>Ativo</span>';
      } else if (isDenied) {
        statusHtml =
          '<button data-perm-id="' + perm.id + '" data-perm-idx="' + i + '" class="airpet-perm-retry-btn" ' +
            'style="padding:6px 12px;border:none;border-radius:8px;background:#fef2f2;color:#dc2626;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s;-webkit-tap-highlight-color:transparent;white-space:nowrap;">' +
            '<i class="fa-solid fa-rotate-right" style="margin-right:3px;"></i>Tentar Novamente' +
          '</button>';
      } else if (isUnsupported) {
        statusHtml = '<span style="color:#9ca3af;font-size:13px;font-weight:600;"><i class="fa-solid fa-circle-minus" style="margin-right:4px;"></i>Indisponível</span>';
      } else {
        statusHtml = '<button data-perm-id="' + perm.id + '" data-perm-idx="' + i + '" class="airpet-perm-allow-btn" style="padding:6px 14px;border:none;border-radius:8px;background:#ec5a1c;color:#fff;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.2s;-webkit-tap-highlight-color:transparent;">Permitir</button>';
      }

      var instrucoesBloqueio = '';
      if (isDenied) {
        instrucoesBloqueio = getInstrucoesBloqueio(perm.id);
      }

      html += '' +
        '<div style="padding:14px 0;' + (i < permissoes.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : '') + '">' +
          '<div style="display:flex;align-items:center;gap:14px;">' +
            '<div class="' + perm.bgIcone + '" style="width:44px;height:44px;min-width:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;">' +
              '<i class="fa-solid ' + perm.icone + ' ' + perm.corIcone + '" style="font-size:18px;"></i>' +
            '</div>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:2px;">' + perm.nome +
                (perm.obrigatoria ? ' <span style="font-size:10px;font-weight:600;color:#ef4444;background:#fef2f2;padding:1px 6px;border-radius:4px;margin-left:4px;">Necessário</span>' : '') +
              '</div>' +
              '<div style="font-size:12px;color:#6b7280;line-height:1.4;">' + perm.descricao + '</div>' +
            '</div>' +
            '<div style="min-width:fit-content;">' + statusHtml + '</div>' +
          '</div>' +
          instrucoesBloqueio +
        '</div>';
    });

    container.innerHTML = html;

    var progressHtml = '';
    permissoes.forEach(function (perm) {
      var estado = estados[perm.id] || 'prompt';
      var cor = estado === 'granted' ? '#10b981' : estado === 'denied' ? '#ef4444' : '#e5e7eb';
      progressHtml += '<div style="width:' + (100 / permissoes.length) + '%;height:4px;border-radius:4px;background:' + cor + ';transition:background 0.3s;"></div>';
    });
    progressContainer.innerHTML = progressHtml;

    var btnPrincipal = document.getElementById('airpet-perm-btn-principal');
    btnPrincipal.removeAttribute('data-action');

    if (concedidas === permissoes.length) {
      btnPrincipal.textContent = 'Tudo Pronto!';
      btnPrincipal.style.background = '#10b981';
    } else {
      var pendentes = permissoes.filter(function (p) {
        var e = estados[p.id] || 'prompt';
        return e !== 'granted' && e !== 'denied' && e !== 'unsupported';
      });
      var bloqueadas = permissoes.filter(function (p) {
        return estados[p.id] === 'denied';
      });

      if (pendentes.length > 0) {
        btnPrincipal.textContent = 'Permitir Tudo (' + pendentes.length + ' restante' + (pendentes.length > 1 ? 's' : '') + ')';
        btnPrincipal.style.background = '#ec5a1c';
      } else if (bloqueadas.length > 0) {
        if (isIOS) {
          btnPrincipal.textContent = 'Abrir Ajustes do iPhone';
          btnPrincipal.setAttribute('data-action', 'open-settings-ios');
        } else {
          btnPrincipal.textContent = 'Continuar mesmo assim';
        }
        btnPrincipal.style.background = '#3b82f6';
      } else {
        btnPrincipal.textContent = 'Continuar';
        btnPrincipal.style.background = '#ec5a1c';
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
        btn.textContent = 'Aguarde...';
        btn.style.opacity = '0.6';

        solicitarPermissao(perm, estados).then(function (resultado) {
          estados[perm.id] = resultado;
          renderizarLista(estados);
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
        btn.style.opacity = '0.6';

        verificarStatusPermissao(perm).then(function (statusReal) {
          if (statusReal === 'granted') {
            estados[perm.id] = 'granted';
            renderizarLista(estados);
            return;
          }

          if (statusReal === 'prompt') {
            solicitarPermissao(perm, estados).then(function (resultado) {
              estados[perm.id] = resultado;
              renderizarLista(estados);
            });
            return;
          }

          estados[perm.id] = 'denied';
          renderizarLista(estados);
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

  function mostrarAlertaSettingsIOS() {
    var msg = 'Para ativar a localização:\n\n' +
      '1. Abra "Ajustes" do iPhone\n' +
      '2. Vá em "Privacidade e Segurança"\n' +
      '3. Toque em "Serviços de Localização"\n' +
      '4. Ative se estiver desligado\n' +
      '5. Role até "Safari" e selecione "Ao Usar o App"\n\n' +
      'Depois volte aqui e recarregue a página.';
    alert(msg);
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
        var elements = criarModal();
        renderizarLista(estados);

        document.getElementById('airpet-perm-btn-principal').addEventListener('click', function () {
          var action = this.getAttribute('data-action');

          if (action === 'open-settings-ios') {
            mostrarAlertaSettingsIOS();
            return;
          }

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
          btn.textContent = 'Solicitando...';
          btn.style.opacity = '0.7';

          var idx = 0;
          function proximaPermissao() {
            if (idx >= pendentes.length) {
              btn.disabled = false;
              btn.style.opacity = '1';
              renderizarLista(estados);

              var todasOk = permissoes.every(function (p) {
                return estados[p.id] === 'granted' || estados[p.id] === 'unsupported';
              });
              if (todasOk) {
                setTimeout(function () { fecharModal(elements, estados, true); }, 600);
              }
              return;
            }

            solicitarPermissao(pendentes[idx], estados).then(function (resultado) {
              estados[pendentes[idx].id] = resultado;
              renderizarLista(estados);
              idx++;
              setTimeout(proximaPermissao, 300);
            });
          }

          proximaPermissao();
        });

        document.getElementById('airpet-perm-btn-pular').addEventListener('click', function () {
          fecharModal(elements, estados, false);
        });

        elements.overlay.addEventListener('click', function (e) {
          if (e.target === elements.overlay) {
            fecharModal(elements, estados, false);
          }
        });
      }, 800);
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
