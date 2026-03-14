(function () {
  'use strict';

  var steps = document.querySelectorAll('.wizard-step');
  if (!steps.length) return;

  var totalSteps = steps.length;
  var currentStep = 1;

  var stepLabel = document.getElementById('stepLabel');
  var stepPercent = document.getElementById('stepPercent');
  var progressBar = document.getElementById('progressBar');

  function showStep(n) {
    steps.forEach(function (el) { el.classList.add('hidden'); });
    var target = document.querySelector('[data-step="' + n + '"]');
    if (target) target.classList.remove('hidden');

    if (stepLabel) stepLabel.textContent = 'Passo ' + n + ' de ' + totalSteps;
    var pct = Math.round((n / totalSteps) * 100);
    if (stepPercent) stepPercent.textContent = pct + '%';
    if (progressBar) progressBar.style.width = pct + '%';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.nextStep = function () {
    var currentEl = document.querySelector('[data-step="' + currentStep + '"]');
    if (currentEl) {
      var requiredInputs = currentEl.querySelectorAll('[required]');
      for (var i = 0; i < requiredInputs.length; i++) {
        if (!requiredInputs[i].value.trim()) {
          requiredInputs[i].focus();
          return;
        }
      }
      var hiddenRequired = currentEl.querySelectorAll('input[type="hidden"][required]');
      for (var j = 0; j < hiddenRequired.length; j++) {
        if (!hiddenRequired[j].value) return;
      }
    }

    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    }
  };

  window.prevStep = function () {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  };

  // --- Type selection highlight ---
  window.selectTipo = function (btn, tipo) {
    document.querySelectorAll('.tipo-btn').forEach(function (b) {
      b.classList.remove('border-primary-500', 'bg-primary-50', 'ring-2', 'ring-primary-200');
      b.classList.add('border-gray-200');
    });
    btn.classList.remove('border-gray-200');
    btn.classList.add('border-primary-500', 'bg-primary-50', 'ring-2', 'ring-primary-200');
    var input = document.getElementById('petTipo');
    if (input) input.value = tipo;
  };

  // --- Photo preview ---
  window.previewFoto = function (input) {
    if (input.files && input.files[0]) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var preview = document.getElementById('fotoPreview');
        var previewContainer = document.getElementById('fotoPreviewContainer');
        var placeholder = document.getElementById('fotoPlaceholder');
        if (preview) preview.src = e.target.result;
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
      };
      reader.readAsDataURL(input.files[0]);
    }
  };

  // --- Description char counter ---
  var descArea = document.getElementById('petDescricao');
  var descCount = document.getElementById('descCount');
  if (descArea && descCount) {
    descArea.addEventListener('input', function () {
      descCount.textContent = this.value.length;
    });
  }

  showStep(1);
})();
