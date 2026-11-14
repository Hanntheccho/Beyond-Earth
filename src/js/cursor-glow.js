if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.querySelector('.cursor-glow');
    let x = 0, y = 0, pending = false;

    window.addEventListener('pointermove', function (event) {
        x = event.clientX;
        y = event.clientY;
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
            glow.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
            glow.style.opacity = '1';
            pending = false;
        });
    }, { passive: true });
}
