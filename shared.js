// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const sunIcon = themeToggle?.querySelector('.sun-icon');
const moonIcon = themeToggle?.querySelector('.moon-icon');
const htmlElement = document.documentElement;

if (themeToggle) {
    const currentTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-theme', currentTheme);
    updateThemeToggle(currentTheme);

    themeToggle.addEventListener('click', () => {
        const theme = htmlElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        htmlElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        updateThemeToggle(theme);
    });

    function updateThemeToggle(theme) {
        if (theme === 'dark') {
            themeToggle.classList.add('active');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            themeToggle.classList.remove('active');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }
}

// Nav Visibility on Scroll (debounced)
let scrollTimeout;
const nav = document.getElementById('nav');
if (nav) {
    const handleScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            nav.classList.toggle('visible', window.scrollY > 100);
        }, 10);
    };
    window.addEventListener('scroll', handleScroll);
}

// Smooth Scroll for Anchor Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Mobile Menu Toggle
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');
const closeButton = document.querySelector('.close-menu');
if (hamburger && mobileMenu) {
    const toggleMenu = () => {
        const isActive = hamburger.classList.contains('active');
        hamburger.classList.toggle('active', !isActive);
        mobileMenu.classList.toggle('active', !isActive);
        hamburger.setAttribute('aria-expanded', !isActive);
    };

    hamburger.addEventListener('click', toggleMenu);

    if (closeButton) {
        closeButton.addEventListener('click', toggleMenu);
    }

    // Close on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
        }
    });
}

// Learning Log Filters (if present)
const filterButtons = document.querySelectorAll?.('.filter-btn');
const articleCards = document.querySelectorAll?.('.article-card');
if (filterButtons && articleCards) {
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
            const filter = button.getAttribute('data-filter');
            articleCards.forEach(card => {
                card.classList.toggle('hidden', !(filter === 'all' || card.dataset.category === filter));
            });
        });
    });
}