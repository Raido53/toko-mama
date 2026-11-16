(function () {
  'use strict';

  // Konfirmasi untuk aksi destruktif.
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!window.confirm(form.getAttribute('data-confirm'))) {
        event.preventDefault();
      }
    });
  });

  // Filter otomatis saat select berubah.
  document.querySelectorAll('[data-auto-submit]').forEach(function (select) {
    select.addEventListener('change', function () {
      var form = select.closest('form');
      if (form) form.submit();
    });
  });

  // Pratinjau gambar sebelum diunggah.
  var imageInput = document.querySelector('[data-image-input]');
  var preview = document.getElementById('image-preview');
  if (imageInput && preview) {
    imageInput.addEventListener('change', function () {
      var file = imageInput.files && imageInput.files[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        window.alert('Format gambar harus JPG, PNG, atau WebP.');
        imageInput.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        window.alert('Ukuran gambar maksimal 2 MB.');
        imageInput.value = '';
        return;
      }
      preview.src = URL.createObjectURL(file);
    });
  }

  // Sembunyikan flash setelah beberapa detik.
  document.querySelectorAll('.flash').forEach(function (item) {
    setTimeout(function () {
      item.classList.add('flash-hide');
    }, 5000);
  });
})();
