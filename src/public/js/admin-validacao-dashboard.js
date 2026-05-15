(function () {
  'use strict';

  var raw = document.getElementById('validacaoChartData');
  if (!raw || !window.Chart) return;

  var data;
  try {
    data = JSON.parse(raw.textContent || '{}');
  } catch (e) {
    return;
  }

  var labelsMap = {
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    panfletos: 'Panfletos',
    rua: 'Busca na rua',
    veterinario: 'Veterinário',
    outro: 'Não saberia o que fazer',
    cachorro: 'Cachorro',
    gato: 'Gato',
    outro_tipo: 'Outro',
    outro: 'Outro',
    sim: 'Sim',
    nao: 'Não',
    talvez: 'Talvez',
    quase: 'Quase perdi',
    identificar_dono: 'Identificar dono',
    contato_tutor: 'Contato com o dono',
    ultima_localizacao: 'Última localização',
    nao_informado: 'Não informado',
  };

  function label(k) {
    return labelsMap[k] || String(k || '').replace(/_/g, ' ');
  }

  function barChart(canvasId, rows, color) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !rows || !rows.length) return;
    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: rows.map(function (r) {
          return label(r.k);
        }),
        datasets: [
          {
            data: rows.map(function (r) {
              return r.c;
            }),
            backgroundColor: color || 'rgba(236, 90, 28, 0.75)',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { maxRotation: 45, minRotation: 0 } },
        },
      },
    });
  }

  function doughnutChart(canvasId, rows) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !rows || !rows.length) return;
    var colors = ['#ec5a1c', '#328dff', '#22c55e', '#a78bfa', '#facc15', '#94a3b8'];
    new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: rows.map(function (r) {
          return label(r.k);
        }),
        datasets: [
          {
            data: rows.map(function (r) {
              return r.c;
            }),
            backgroundColor: rows.map(function (_, i) {
              return colors[i % colors.length];
            }),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  barChart('chartMetodos', data.metodosBusca);
  barChart('chartTipoPet', data.tipoPet, 'rgba(50, 141, 245, 0.75)');
  doughnutChart('chartBeta', data.betaInteresse);
  doughnutChart('chartPerdeu', data.perdeuPet);
  barChart('chartPrioridades', data.prioridades, 'rgba(34, 197, 94, 0.75)');
})();
