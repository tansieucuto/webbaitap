/**
 * TỔ VÀNG — ANIMATIONS.JS
 * Dự phòng hỗ trợ hiệu ứng hiển thị bổ trợ (Élan Studio System)
 */

(function () {
  'use strict';

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.fade-in, .reveal').forEach(el => observer.observe(el));
})();
