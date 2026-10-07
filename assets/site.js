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

// Try each source once; keep NO IMAGE until a source succeeds.
function loadPoster(img) {
  const urls = JSON.parse(img.dataset.posterUrls);
  let index = 0;
  function next() {
    if (index >= urls.length) return;
    const probe = new Image();
    const url = urls[index++];
    let settled = false;
    const timer = setTimeout(() => finish(false), 10000);
    function finish(ok) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      probe.onload = probe.onerror = null;
      if (!ok) { next(); return; }
      img.src = url;
      img.hidden = false;
      img.parentElement.classList.add('has-poster');
      img.parentElement.setAttribute('aria-label', img.alt);
    }
    probe.onload = () => finish(probe.naturalWidth > 0);
    probe.onerror = () => finish(false);
    probe.src = url;
  }
  next();
}
const posterObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    posterObserver.unobserve(entry.target);
    loadPoster(entry.target.querySelector('[data-poster-urls]'));
  });
}, {rootMargin: '200px'}) : null;
document.querySelectorAll('[data-poster-urls]').forEach(img => {
  if (posterObserver) posterObserver.observe(img.parentElement);
  else loadPoster(img);
});