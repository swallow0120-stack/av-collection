const search = document.querySelector('#search');
const category = document.querySelector('#category');
function filter() {
  const query = search.value.trim().toLocaleLowerCase();
  let total = 0;
  document.querySelectorAll('.category').forEach(section => {
    let visible = 0;
    section.querySelectorAll('.entry').forEach(entry => {
      entry.hidden = Boolean(category.value && section.dataset.category !== category.value) || !entry.dataset.search.toLocaleLowerCase().includes(query);
      if (!entry.hidden) visible++;
    });
    section.hidden = visible === 0;
    total += visible;
  });
  document.querySelector('#result-count').textContent = `顯示 ${total} 部`;
  document.querySelector('#empty').hidden = total !== 0;
}
search.addEventListener('input', filter);
category.addEventListener('change', filter);
document.querySelector('#clear').addEventListener('click', () => {search.value = ''; category.value = ''; filter(); search.focus();});

// Web pages may reject framing without exposing a detectable error.
// Always keep the original URL accessible, even after an iframe load event.
function setupPreview(box) {
  const urls = JSON.parse(box.dataset.previewUrls);
  const stage = box.querySelector('.preview-stage');
  const original = box.querySelector('.preview-open');
  const next = box.querySelector('.preview-next');
  const status = box.querySelector('.preview-status');
  const placeholder = stage.firstElementChild.cloneNode(true);
  let index = -1, generation = 0, timer;
  function show(at) {
    clearTimeout(timer);
    index = at;
    const attempt = ++generation;
    stage.replaceChildren(placeholder.cloneNode(true));
    const url = new URL(urls[index]);
    original.href = url.href;
    status.textContent = `來源 ${index + 1} / ${urls.length} · 載入中…`;
    if (url.protocol !== 'https:') {
      original.removeAttribute('href');
      status.textContent = '來源必須使用 HTTPS。';
      return;
    }
    const isImage = /\.(?:jpe?g|png|webp|gif|avif|svg)$/i.test(url.pathname);
    if (isImage) {
      const image = new Image();
      image.alt = box.dataset.code + ' 圖片';
      image.className = 'preview-image';
      let settled = false;
      function finish(ok) {
        if (settled || attempt !== generation) return;
        settled = true;
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (ok) {
          stage.replaceChildren(image);
          status.textContent = `來源 ${index + 1} / ${urls.length} · 圖片已載入`;
        } else if (index + 1 < urls.length) show(index + 1);
        else status.textContent = '圖片載入失敗，可開啟原網頁或切換來源。';
      }
      image.onload = () => finish(image.naturalWidth > 0);
      image.onerror = () => finish(false);
      timer = setTimeout(() => finish(false), 10000);
      image.src = url.href;
    } else {
      const frame = document.createElement('iframe');
      frame.title = box.dataset.code + ' 網頁預覽';
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
      frame.referrerPolicy = 'no-referrer';
      frame.src = url.href;
      stage.replaceChildren(frame);
      status.textContent = `來源 ${index + 1} / ${urls.length} · 若預覽空白或遭封鎖，請開啟原網頁。`;
    }
  }
  next.disabled = urls.length < 2;
  next.addEventListener('click', () => show((index + 1) % urls.length));
  return () => { if (index < 0 && urls.length) show(0); };
}
const previewStarts = new WeakMap();
const previewObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    previewObserver.unobserve(entry.target);
    previewStarts.get(entry.target)();
  });
}, {rootMargin: '200px'}) : null;
document.querySelectorAll('.content-preview').forEach(box => {
  const start = setupPreview(box);
  previewStarts.set(box, start);
  if (previewObserver) previewObserver.observe(box);
  else start();
});