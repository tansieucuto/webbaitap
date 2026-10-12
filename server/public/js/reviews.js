/**
 * TỔ VÀNG — REVIEWS.JS
 * Quản lý & Hiển thị Đánh Giá Khách Hàng (Élan Studio System)
 */

(function () {
  'use strict';

  const api = window.TovangApi;

  function formatDate(dateStr) {
    if (!dateStr) return 'Đã thẩm định';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) {
      return 'Đã thẩm định';
    }
  }

  // Tải danh sách đánh giá
  async function loadReviews() {
    const grid = document.getElementById('reviewsGrid');
    const avgScoreEl = document.getElementById('reviewsAvgScore');
    const totalCountEl = document.getElementById('reviewsTotalCount');

    if (!grid) return;

    try {
      const res = await api.get('/api/v1/reviews');
      if (res.success && res.data) {
        const reviewsData = res.data.reviews || [];
        const stats = res.data.stats || {};

        if (avgScoreEl) avgScoreEl.textContent = (stats.average_rating || 5.0).toFixed(1);
        if (totalCountEl) totalCountEl.textContent = `${stats.total_reviews || reviewsData.length} đánh giá đã xác thực`;

        grid.innerHTML = '';
        reviewsData.forEach(item => {
          const card = document.createElement('div');
          card.className = 'testimonial reveal visible';

          const quoteGlyph = document.createElement('div');
          quoteGlyph.className = 'testimonial-quote-glyph';
          quoteGlyph.textContent = '“';

          const ratingRow = document.createElement('div');
          ratingRow.className = 'testimonial-rating-row';
          ratingRow.textContent = `${item.rating}.0 / 5.0 — THẨM ĐỊNH THỰC TẾ`;

          const textP = document.createElement('p');
          textP.className = 'testimonial-text';
          textP.textContent = `"${item.content}"`;

          const authorDiv = document.createElement('div');
          authorDiv.className = 'testimonial-author';

          const nameDiv = document.createElement('div');
          nameDiv.className = 'author-name';
          nameDiv.textContent = item.author_name || 'Khách hàng';

          const dateDiv = document.createElement('div');
          dateDiv.className = 'author-loc';
          dateDiv.textContent = formatDate(item.created_at);

          authorDiv.appendChild(nameDiv);
          authorDiv.appendChild(dateDiv);

          card.appendChild(quoteGlyph);
          card.appendChild(ratingRow);
          card.appendChild(textP);
          card.appendChild(authorDiv);

          grid.appendChild(card);
        });
      }
    } catch (err) {
      console.warn('Lỗi tải đánh giá:', err.message);
    }
  }

  // Xử lý Modal & Gửi đánh giá
  function setupReviewModal() {
    const modal = document.getElementById('reviewModal');
    const openBtn = document.getElementById('btnOpenReviewModal');
    const closeBtn = document.getElementById('btnCloseReviewModal');
    const cancelBtn = document.getElementById('btnCancelReview');
    const form = document.getElementById('reviewForm');
    const starPicker = document.getElementById('starPicker');
    const ratingInput = document.getElementById('reviewRatingInput');
    const msgEl = document.getElementById('reviewFormMsg');

    if (!modal) return;

    const openModal = () => {
      if (!api.isLoggedIn()) {
        api.showToast('Vui lòng đăng nhập tài khoản để gửi đánh giá thẩm định.', 'info');
        window.TovangAuth?.openAuthModal('login');
        return;
      }
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (msgEl) msgEl.style.display = 'none';
      const user = api.getUser();
      const nameInput = document.getElementById('reviewNameInput');
      if (nameInput && user) nameInput.value = user.full_name || '';
    };

    const closeModal = () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      if (form) form.reset();
      setRating(5);
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });

    function setRating(val) {
      if (ratingInput) ratingInput.value = val;
      if (starPicker) {
        const starBtns = starPicker.querySelectorAll('.star-btn');
        starBtns.forEach((btn) => {
          const v = parseInt(btn.getAttribute('data-value'), 10);
          btn.classList.toggle('active', v <= val);
        });
      }
    }

    if (starPicker) {
      const starBtns = starPicker.querySelectorAll('.star-btn');
      starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.getAttribute('data-value'), 10);
          setRating(val);
        });
      });
    }

    // Gửi đánh giá lên API
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const rating = parseInt(ratingInput ? ratingInput.value : '5', 10) || 5;
        const content = document.getElementById('reviewContentInput')?.value.trim();
        const submitBtn = document.getElementById('btnSubmitReview');

        if (!content || content.length < 3) {
          showMsg('Vui lòng nhập nội dung đánh giá ít nhất 3 ký tự.', 'error');
          return;
        }

        if (content.length > 1000) {
          showMsg('Nội dung nhận xét tối đa 1000 ký tự.', 'error');
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Đang gửi...';
        }

        try {
          const payload = {
            product_id: 1, // Mật ong rừng Hà Tĩnh
            rating,
            content
          };

          const res = await api.post('/api/v1/reviews', payload);

          if (res.success) {
            showMsg(res.message || 'Gửi đánh giá thành công. Cảm ơn bạn.', 'success');
            api.showToast('Gửi đánh giá thành công!', 'success');
            setTimeout(() => {
              closeModal();
              loadReviews();
            }, 1000);
          }
        } catch (err) {
          showMsg(err.message || 'Không thể gửi đánh giá, vui lòng thử lại.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gửi Đánh Giá';
          }
        }
      });
    }

    function showMsg(text, type) {
      if (!msgEl) return;
      msgEl.textContent = text;
      msgEl.style.display = 'block';
      msgEl.className = 'form-message ' + type;
    }
  }

  // Khởi chạy khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadReviews();
      setupReviewModal();
    });
  } else {
    loadReviews();
    setupReviewModal();
  }

  window.TovangReviews = {
    loadReviews,
    openModal: () => {
      const openBtn = document.getElementById('btnOpenReviewModal');
      openBtn?.click();
    }
  };
})();
