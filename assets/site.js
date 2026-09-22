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
