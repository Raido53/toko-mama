(function () {
  'use strict';

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var EYE_ICON =
    '<svg class="icon-eye" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF_ICON =
    '<svg class="icon-eye-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.3 4"/><path d="M6.5 7.6A16.8 16.8 0 0 0 2.5 12S6 18 12 18a9.6 9.6 0 0 0 4.2-.9"/><path d="M9.9 10.2a3 3 0 0 0 4.1 4.1"/></svg>';

  /* ---------------------- Konfirmasi aksi ---------------------- */
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!window.confirm(form.getAttribute('data-confirm'))) event.preventDefault();
    });
  });

  /* ---------------------- Filter otomatis ---------------------- */
  document.querySelectorAll('[data-auto-submit]').forEach(function (select) {
    select.addEventListener('change', function () {
      var form = select.closest('form');
      if (form) form.submit();
    });
  });

  /* ---------------------- Pratinjau gambar ---------------------- */
  document.querySelectorAll('input[type="file"][data-image-input]').forEach(function (input) {
    var targetSelector = input.getAttribute('data-preview-target');
    var preview = targetSelector
      ? document.querySelector(targetSelector)
      : document.getElementById('image-preview');
    if (!preview) return;

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        window.alert('Format gambar harus JPG, PNG, atau WebP.');
        input.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        window.alert('Ukuran gambar maksimal 2 MB.');
        input.value = '';
        return;
      }
      preview.src = URL.createObjectURL(file);
    });
  });

  /* ---------------------- Flash auto hide ---------------------- */
  document.querySelectorAll('.flash').forEach(function (item) {
    setTimeout(function () {
      item.classList.add('flash-hide');
    }, 5000);
  });

  /* ---------------------- Toggle lihat password ---------------------- */
  document.querySelectorAll('input[type="password"]').forEach(function (input) {
    if (input.dataset.pwToggleReady === '1') return;
    input.dataset.pwToggleReady = '1';

    var wrapper = document.createElement('div');
    wrapper.className = 'password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pw-toggle';
    button.setAttribute('aria-label', 'Tampilkan password');
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('title', 'Tampilkan password');
    button.innerHTML = EYE_ICON + EYE_OFF_ICON;
    wrapper.appendChild(button);

    button.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
      button.setAttribute('title', show ? 'Sembunyikan password' : 'Tampilkan password');
      try {
        input.focus({ preventScroll: true });
      } catch (error) {
        input.focus();
      }
    });
  });

  /* ---------------------- Validasi form ---------------------- */
  function controlOf(input) {
    return input.closest('.password-field') || input;
  }

  function messageElement(input) {
    var control = controlOf(input);
    var selector = '.field-msg[data-for="' + input.name + '"]';
    var existing = control.parentNode.querySelector(selector);
    if (existing) return existing;

    var element = document.createElement('p');
    element.className = 'field-msg is-hidden';
    element.setAttribute('data-for', input.name);
    element.setAttribute('role', 'status');
    control.parentNode.insertBefore(element, control.nextSibling);
    return element;
  }

  function setMessage(input, text, state) {
    var element = messageElement(input);
    element.textContent = text || '';
    element.dataset.state = state || '';
    element.classList.toggle('is-hidden', !text);
    input.setAttribute('aria-invalid', state === 'error' ? 'true' : 'false');
  }

  function passwordScore(value) {
    var score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-zA-Z]/.test(value) && /\d/.test(value)) score += 1;
    if (/[^a-zA-Z0-9]/.test(value)) score += 1;
    return score;
  }

  function updateMeter(form) {
    var meter = form.querySelector('[data-pw-meter]');
    if (!meter) return;

    var field = form.querySelector('[name="' + meter.getAttribute('data-for') + '"]');
    var value = field ? field.value : '';
    var score = value ? passwordScore(value) : 0;
    var bar = meter.querySelector('.pw-meter-bar span');
    var label = meter.querySelector('.pw-meter-label strong');
    var levels = ['—', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'];

    if (bar) bar.style.width = String((score / 4) * 100) + '%';
    if (label) label.textContent = levels[score] || '—';

    var confirm = form.querySelector('[data-check="match"]');
    var rules = {
      length: value.length >= 8,
      mix: /[a-zA-Z]/.test(value) && /\d/.test(value),
      match: Boolean(value) && Boolean(confirm) && confirm.value === value,
    };

    meter.querySelectorAll('[data-rule]').forEach(function (item) {
      item.classList.toggle('ok', Boolean(rules[item.getAttribute('data-rule')]));
    });
  }

  function validate(input, form) {
    var check = input.getAttribute('data-check');
    if (!check) return true;

    var value = input.value;
    var optional = input.hasAttribute('data-optional');
    var min = Number(input.getAttribute('data-min') || 8);

    if (check === 'email') {
      if (!value.trim()) {
        setMessage(input, 'Email wajib diisi.', 'error');
        return false;
      }
      if (!EMAIL_PATTERN.test(value.trim())) {
        setMessage(input, 'Format email belum benar. Contoh: nama@email.com', 'error');
        return false;
      }
      setMessage(input, 'Format email valid.', 'ok');
      return true;
    }

    if (check === 'password') {
      if (!value) {
        if (optional) {
          setMessage(input, '', '');
          return true;
        }
        setMessage(input, 'Password wajib diisi.', 'error');
        return false;
      }
      if (value.length < min) {
        setMessage(
          input,
          'Password minimal ' + min + ' karakter (sekarang ' + value.length + ').',
          'error'
        );
        return false;
      }
      setMessage(input, 'Panjang password sudah cukup.', 'ok');
      return true;
    }

    if (check === 'match') {
      var targetName = input.getAttribute('data-match-input');
      var target = targetName ? form.querySelector('[name="' + targetName + '"]') : null;
      if (!value) {
        setMessage(input, 'Ulangi password untuk konfirmasi.', 'error');
        return false;
      }
      if (target && value !== target.value) {
        setMessage(input, 'Konfirmasi password belum sama.', 'error');
        return false;
      }
      setMessage(input, 'Konfirmasi password cocok.', 'ok');
      return true;
    }

    return true;
  }

  document.querySelectorAll('form[data-check-form]').forEach(function (form) {
    var inputs = Array.prototype.slice.call(form.querySelectorAll('[data-check]'));

    inputs.forEach(function (input) {
      input.addEventListener('blur', function () {
        input.dataset.touched = '1';
        validate(input, form);
        updateMeter(form);
      });

      input.addEventListener('input', function () {
        if (input.dataset.touched === '1' || input.value) validate(input, form);
        updateMeter(form);

        var matchField = form.querySelector('[data-check="match"]');
        if (matchField && input.name !== matchField.name && matchField.value) {
          validate(matchField, form);
        }
      });
    });

    form.addEventListener('submit', function (event) {
      var firstInvalid = null;
      inputs.forEach(function (input) {
        input.dataset.touched = '1';
        if (!validate(input, form) && !firstInvalid) firstInvalid = input;
      });
      updateMeter(form);

      if (firstInvalid) {
        event.preventDefault();
        firstInvalid.focus();
      }
    });
  });
})();
