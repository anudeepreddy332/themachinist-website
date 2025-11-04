document.addEventListener("DOMContentLoaded", () => {
  const includes = document.querySelectorAll('[data-include]');
  let includesLoaded = 0;

  includes.forEach(el => {
    const file = el.getAttribute('data-include');
    fetch(file)
      .then(response => {
        if (!response.ok) throw new Error(`Error loading ${file}`);
        return response.text();
      })
      .then(data => {
        el.outerHTML = data;
        includesLoaded++;
        if (includesLoaded === includes.length) {
          initThemeToggle(); // Initialize dark mode toggle after all includes are injected
        }
      })
      .catch(err => console.error(err));
  });
});

function initThemeToggle() {
  const html = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', savedTheme);

  const themeToggle = document.querySelector('.theme-toggle');
  if (!themeToggle) return;

  const sunIcon = themeToggle.querySelector('.sun-icon');
  const moonIcon = themeToggle.querySelector('.moon-icon');

  // Initial state
  updateToggle(savedTheme);

  // Listen for toggle clicks
  themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateToggle(newTheme);
  });

  function updateToggle(theme) {
    if (theme === 'dark') {
      themeToggle.classList.add('active');
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'block';
    } else {
      themeToggle.classList.remove('active');
      if (sunIcon) sunIcon.style.display = 'block';
      if (moonIcon) moonIcon.style.display = 'none';
    }
  }
}