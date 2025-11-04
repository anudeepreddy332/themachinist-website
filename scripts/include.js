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
          initThemeToggle(); // Reinitialize dark mode toggle once all includes are loaded
        }
      })
      .catch(err => console.error(err));
  });
});

function initThemeToggle() {
  // Restore saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Find the toggle button
  const themeToggle = document.querySelector('.theme-toggle');
  if (!themeToggle) return;

  if (savedTheme === 'dark') {
    themeToggle.classList.add('active');
  }

  themeToggle.addEventListener('click', () => {
    const isActive = themeToggle.classList.toggle('active');
    const newTheme = isActive ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}