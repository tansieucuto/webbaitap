/**
 * TỔ VÀNG — MAIN.JS
 * Quản lý tương tác giao diện, scroll reveal và mobile navigation (Élan Studio System)
 */

(function () {
  'use strict';

  // 1. SCROLL REVEAL (IntersectionObserver)
  function setupScrollAnimations() {
    const revealEls = document.querySelectorAll('.reveal, .fade-in');
    if (!revealEls.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );

      revealEls.forEach(el => observer.observe(el));
    } else {
      revealEls.forEach(el => el.classList.add('visible'));
    }
  }

  // 2. MOBILE MENU TOGGLE (Typographic)
  function setupMobileMenu() {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');

    if (toggleBtn && navLinks) {
      toggleBtn.addEventListener('click', () => {
        const isActive = navLinks.classList.toggle('active');
        toggleBtn.textContent = isActive ? '[ ĐÓNG ]' : '[ MENU ]';
        toggleBtn.setAttribute('aria-expanded', isActive);
      });

      // Đóng menu khi click vào một link
      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('active');
          toggleBtn.textContent = '[ MENU ]';
        });
      });
    }
  }

  // 3. SMOOTH SCROLL ANCHOR
  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#' || !targetId) return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          const navHeight = document.querySelector('nav')?.offsetHeight || 75;
          const targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - navHeight;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  // Khởi chạy khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupScrollAnimations();
      setupMobileMenu();
      setupSmoothScroll();
    });
  } else {
    setupScrollAnimations();
    setupMobileMenu();
    setupSmoothScroll();
  }
})();

