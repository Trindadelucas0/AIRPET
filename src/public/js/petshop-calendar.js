;(function () {
  var grid = document.querySelector('[data-calendar-grid]')
  var monthEl = document.querySelector('[data-calendar-current-month]')
  var yearEl = document.querySelector('[data-calendar-current-year]')
  if (!grid || !monthEl || !yearEl) return

  var month = new Date().getMonth()
  var year = new Date().getFullYear()

  var monthNames = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro'
  ]

  function getResumoDia(dateStr) {
    if (!window.__agendaDiasResumo) return null
    return window.__agendaDiasResumo[dateStr] || null
  }

  function formatKey(date) {
    var d = String(date.getDate()).padStart(2, '0')
    var m = String(date.getMonth() + 1).padStart(2, '0')
    var y = date.getFullYear()
    return y + '-' + m + '-' + d
  }

  function render() {
    grid.innerHTML = ''
    var baseDate = new Date(year, month, 1)
    var firstDay = baseDate.getDay()
    var daysInMonth = new Date(year, month + 1, 0).getDate()

    monthEl.textContent =
      monthNames[month].charAt(0).toUpperCase() + monthNames[month].slice(1)
    yearEl.textContent = year

    for (var i = 0; i < firstDay; i++) {
      var empty = document.createElement('div')
      empty.className = 'h-7 md:h-8'
      grid.appendChild(empty)
    }

    var hoje = new Date()
    var hojeKey = formatKey(hoje)

    for (var day = 1; day <= daysInMonth; day++) {
      var date = new Date(year, month, day)
      var key = formatKey(date)
      var resumo = getResumoDia(key)

      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className =
        'relative flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-xl text-xs md:text-sm transition-colors duration-150'

      var isHoje = key === hojeKey
      var baseClasses =
        'bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--secondary)]'
      var livreClasses =
        'bg-[color:var(--accent)]/70 text-[color:var(--accent-foreground)] border-none'
      var cheioClasses =
        'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] border-none'

      if (resumo && resumo.status === 'lotado') {
        btn.className += ' ' + cheioClasses
      } else if (resumo && resumo.status === 'parcial') {
        btn.className += ' ' + livreClasses
      } else {
        btn.className += ' ' + baseClasses
      }

      if (isHoje) {
        btn.className +=
          ' ring-1 ring-[color:var(--ring)] ring-offset-2 ring-offset-[color:var(--card)]'
      }

      btn.dataset.date = key
      btn.textContent = String(day)

      btn.addEventListener('click', function (e) {
        var d = e.currentTarget.dataset.date
        if (!d) return
        var link = document.querySelector('[data-agenda-dia-link]')
        if (link) {
          var url = link.getAttribute('href')
          if (url && url.indexOf('?') === -1) {
            window.location.href = url + '?dia=' + d
          } else if (url) {
            window.location.href = url + '&dia=' + d
          }
        }
      })

      grid.appendChild(btn)
    }
  }

  var prevBtn = document.querySelector('[data-calendar-prev]')
  var nextBtn = document.querySelector('[data-calendar-next]')

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      month--
      if (month < 0) {
        month = 11
        year--
      }
      render()
    })
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      month++
      if (month > 11) {
        month = 0
        year++
      }
      render()
    })
  }

  render()
})()

