(function () {
  'use strict';

  var chatContainer = document.getElementById('chatMessages');
  var chatForm = document.getElementById('chatForm');
  var chatInput = document.getElementById('chatInput');
  var photoInput = document.getElementById('chatPhoto');
  var conversaId = document.getElementById('conversaId');

  if (!chatContainer || !conversaId) return;

  var socket = io('/chat');
  var roomId = conversaId.value;

  socket.emit('entrar_conversa', { conversa_id: roomId });

  // --- Send text message ---
  if (chatForm) {
    chatForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var texto = chatInput.value.trim();
      if (!texto) return;

      socket.emit('enviar_mensagem', {
        conversa_id: roomId,
        tipo: 'texto',
        conteudo: texto
      });

      appendMessage({
        conteudo: texto,
        tipo: 'texto',
        remetente: 'eu',
        pendente: true
      });

      chatInput.value = '';
    });
  }

  // --- Photo upload ---
  var chatPhotoUploadBusy = false;
  if (photoInput) {
    photoInput.addEventListener('change', function () {
      if (!this.files || !this.files[0]) return;
      if (chatPhotoUploadBusy) return;
      chatPhotoUploadBusy = true;
      photoInput.disabled = true;

      var formData = new FormData();
      formData.append('foto', this.files[0]);
      formData.append('conversa_id', roomId);

      var c = typeof globalThis !== 'undefined' && globalThis.AIRPET_REQ_COORDINATOR ? globalThis.AIRPET_REQ_COORDINATOR : null;
      var uploadFn = function (signal) {
        return fetch('/chat/upload-foto', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          signal: signal || undefined
        }).then(function (res) { return res.json(); });
      };
      var pr = c && c.enqueue
        ? c.enqueue({
          key: 'chatUpload:' + roomId,
          group: 'chatUpload',
          priority: c.PRIORITY ? c.PRIORITY.MEDIUM : 'MEDIUM',
          fetchFn: uploadFn
        })
        : uploadFn();

      var uploadChain = function () {
        return Promise.resolve(pr).then(function (data) {
          if (data.url) {
            socket.emit('enviar_mensagem', {
              conversa_id: roomId,
              tipo: 'foto',
              conteudo: data.url
            });

            appendMessage({
              conteudo: data.url,
              tipo: 'foto',
              remetente: 'eu',
              pendente: true
            });
          }
        });
      };
      var L = typeof globalThis !== 'undefined' ? globalThis.AIRPET_LOADING : null;
      var wrapped = L && typeof L.withDeferredOverlay === 'function'
        ? L.withDeferredOverlay(uploadChain, { message: 'A enviar foto…' })
        : uploadChain();
      wrapped.catch(function (err) {
        console.error('Erro ao enviar foto:', err);
      }).finally(function () {
        chatPhotoUploadBusy = false;
        photoInput.disabled = false;
        photoInput.value = '';
      });
    });
  }

  // --- Receive approved messages ---
  socket.on('mensagem_aprovada', function (msg) {
    appendMessage({
      conteudo: msg.conteudo,
      tipo: msg.tipo,
      remetente: msg.remetente_id,
      nome: msg.remetente_nome,
      pendente: false
    });
  });

  // --- Append message to DOM ---
  function appendMessage(msg) {
    var div = document.createElement('div');
    div.className = 'flex flex-col mb-3 ' + (msg.remetente === 'eu' ? 'items-end' : 'items-start');

    var bubble = document.createElement('div');
    bubble.className = 'max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ' +
      (msg.remetente === 'eu'
        ? 'bg-primary-500 text-white rounded-br-md'
        : 'bg-gray-100 text-gray-800 rounded-bl-md');

    if (msg.tipo === 'foto') {
      var img = document.createElement('img');
      img.src = msg.conteudo;
      img.alt = 'Foto';
      img.className = 'max-h-48 rounded-lg';
      bubble.appendChild(img);
    } else {
      bubble.textContent = msg.conteudo;
    }

    div.appendChild(bubble);

    if (msg.pendente) {
      var status = document.createElement('span');
      status.className = 'text-[10px] text-gray-400 mt-1 italic';
      status.textContent = 'Aguardando moderação';
      div.appendChild(status);
    }

    if (msg.nome && msg.remetente !== 'eu') {
      var nameEl = document.createElement('span');
      nameEl.className = 'text-[10px] text-gray-400 mt-1';
      nameEl.textContent = msg.nome;
      div.appendChild(nameEl);
    }

    chatContainer.appendChild(div);
    scrollToBottom();
  }

  // --- Auto-scroll ---
  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  scrollToBottom();
})();
