        // active state for jump nav
        const jumpLinks = document.querySelectorAll('.sl-jump-nav a');
        const familyBlocks = document.querySelectorAll('.sl-family-block[id]');
        const jumpObserver = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    jumpLinks.forEach(l => l.classList.remove('active'));
                    const active = document.querySelector(`.sl-jump-nav a[href="#${e.target.id}"]`);
                    if (active) active.classList.add('active');
                }
            });
        }, { rootMargin: '-130px 0px -55% 0px' });
        familyBlocks.forEach(b => jumpObserver.observe(b));
