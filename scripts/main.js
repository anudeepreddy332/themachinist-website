// Wait until both includes and DOM are ready
window.addEventListener("load", () => {
  // Dark Mode Toggle
  const themeToggle = document.getElementById("themeToggle");
  const html = document.documentElement;
  let currentTheme = localStorage.getItem("theme") || "light";
  html.setAttribute("data-theme", currentTheme);
  if (currentTheme === "dark") themeToggle?.classList.add("active");

  themeToggle?.addEventListener("click", () => {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    html.setAttribute("data-theme", currentTheme);
    localStorage.setItem("theme", currentTheme);
    themeToggle.classList.toggle("active");
  });

  // Navbar reveal on scroll
  const nav = document.getElementById("nav");
  let lastScrollY = window.scrollY;
  window.addEventListener("scroll", () => {
    if (window.scrollY > 100 && window.scrollY > lastScrollY) {
      nav?.classList.add("visible");
    } else if (window.scrollY < lastScrollY) {
      nav?.classList.remove("visible");
    }
    lastScrollY = window.scrollY;
  });

  // Smooth Scroll (for anchor links)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        window.scrollTo({
          top: target.offsetTop - 80,
          behavior: "smooth"
        });
      }
    });
  });
});