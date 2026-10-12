/**
 * TỔ VÀNG — CART.JS
 * Quản lý Giỏ Hàng Đồng Bộ Backend API v1, Drawer Giỏ Hàng & Kích Hoạt Checkout
 */

(function () {
  'use strict';

  const api = window.TovangApi;
  let cartData = {
    items: [],
    subtotal: 0,
    shipping_fee: 0,
    total: 0,
    free_shipping_threshold: 500000
  };

  async function loadCart() {
    try {
      const res = await api.get('/api/v1/cart');
      if (res.success && res.data) {
        cartData = res.data;
        renderCart();
      }
    } catch (err) {
      console.warn('Không thể nạp giỏ hàng từ máy chủ:', err.message);
    }
  }

  async function addItem(variantId, quantity = 1) {
    try {
      const res = await api.post('/api/v1/cart/items', {
        variant_id: variantId,
        quantity
      });
      if (res.success && res.data) {
        cartData = res.data;
        renderCart();
        api.showToast('Đã thêm sản phẩm vào giỏ hàng!', 'success');
      }
      return res;
    } catch (err) {
      api.showToast(err.message, 'error');
      throw err;
    }
  }

  async function updateItem(itemId, quantity) {
    try {
      const res = await api.patch(`/api/v1/cart/items/${itemId}`, { quantity });
      if (res.success && res.data) {
        cartData = res.data;
        renderCart();
      }
    } catch (err) {
      api.showToast(err.message, 'error');
    }
  }

  async function removeItem(itemId) {
    try {
      const res = await api.delete(`/api/v1/cart/items/${itemId}`);
      if (res.success && res.data) {
        cartData = res.data;
        renderCart();
        api.showToast('Đã xóa sản phẩm khỏi giỏ hàng.', 'info');
      }
    } catch (err) {
      api.showToast(err.message, 'error');
    }
  }

  function renderCart() {
    const cartBadge = document.getElementById('cartBadge');
    const cartBody = document.getElementById('cartDrawerBody');
    const subtotalEl = document.getElementById('cartSubtotal');
    const shippingProgress = document.getElementById('cartShippingProgress');
    const shippingNotice = document.getElementById('cartShippingNotice');

    const totalCount = (cartData.items || []).reduce((sum, item) => sum + item.quantity, 0);
    if (cartBadge) {
      cartBadge.textContent = totalCount;
    }

    if (!cartBody) return;

    if (!cartData.items || cartData.items.length === 0) {
      cartBody.innerHTML = `
        <div class="cart-empty">
          <span class="cart-empty-tag">[ DANH MỤC TRỐNG ]</span>
          <h4>Giỏ Hàng Chưa Có Sản Phẩm</h4>
          <p style="font-size:0.78rem; margin-top:0.8rem; color:#8a8278; line-height:1.8;">
            Vui lòng chọn các dòng mật ong rừng nguyên bản từ bộ sưu tập để tiếp tục đặt hàng.
          </p>
        </div>
      `;
      if (subtotalEl) subtotalEl.textContent = '0đ';
      if (shippingProgress) shippingProgress.style.width = '0%';
      if (shippingNotice) shippingNotice.textContent = 'Mua thêm 500.000đ để được miễn phí vận chuyển';
      return;
    }

    // Render danh sách sản phẩm từ backend
    let html = '';
    cartData.items.forEach(item => {
      const itemPrice = api.formatMoney(item.price);
      html += `
        <div class="cart-item" data-id="${item.id}">
          <div class="cart-item-code">${item.sku || 'MOR'}</div>
          <div class="cart-item-details">
            <div class="cart-item-name">${item.product_name}</div>
            <div class="cart-item-price">${item.variant_name} · ${itemPrice}</div>
            <div class="cart-item-qty">
              <button type="button" class="qty-btn btn-qty-dec" data-id="${item.id}" data-qty="${item.quantity - 1}">-</button>
              <span style="font-size:0.75rem; font-family:var(--font-mono); min-width:24px; text-align:center;">${item.quantity}</span>
              <button type="button" class="qty-btn btn-qty-inc" data-id="${item.id}" data-qty="${item.quantity + 1}">+</button>
            </div>
          </div>
          <button type="button" class="cart-item-remove btn-item-del" data-id="${item.id}" title="Xóa">[ XÓA ]</button>
        </div>
      `;
    });

    cartBody.innerHTML = html;

    // Gắn sự kiện tăng giảm xóa
    cartBody.querySelectorAll('.btn-qty-dec').forEach(b => {
      b.addEventListener('click', () => updateItem(b.getAttribute('data-id'), parseInt(b.getAttribute('data-qty'), 10)));
    });
    cartBody.querySelectorAll('.btn-qty-inc').forEach(b => {
      b.addEventListener('click', () => updateItem(b.getAttribute('data-id'), parseInt(b.getAttribute('data-qty'), 10)));
    });
    cartBody.querySelectorAll('.btn-item-del').forEach(b => {
      b.addEventListener('click', () => removeItem(b.getAttribute('data-id')));
    });

    // Subtotal
    if (subtotalEl) {
      subtotalEl.textContent = api.formatMoney(cartData.subtotal);
    }

    // Free shipping bar
    if (shippingProgress && shippingNotice) {
      const threshold = cartData.free_shipping_threshold || 500000;
      const percent = Math.min(100, Math.round((cartData.subtotal / threshold) * 100));
      shippingProgress.style.width = `${percent}%`;

      if (cartData.subtotal >= threshold) {
        shippingNotice.innerHTML = '<strong style="color:var(--rust);">Đủ điều kiện Miễn phí giao hàng toàn quốc</strong>';
      } else {
        const remaining = threshold - cartData.subtotal;
        shippingNotice.textContent = `Mua thêm ${api.formatMoney(remaining)} để được miễn phí vận chuyển`;
      }
    }
  }

  function openCart() {
    const overlay = document.getElementById('cartDrawerOverlay');
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCart() {
    const overlay = document.getElementById('cartDrawerOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function setupCartUI() {
    const openBtn = document.getElementById('btnNavCart');
    const closeBtn = document.getElementById('btnCloseCartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    const checkoutBtn = document.getElementById('btnCheckout');

    openBtn?.addEventListener('click', openCart);
    closeBtn?.addEventListener('click', closeCart);

    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeCart();
      });
    }

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (!cartData.items || cartData.items.length === 0) {
          api.showToast('Giỏ hàng của bạn đang trống.', 'error');
          return;
        }

        // Bắt buộc đăng nhập trước khi checkout
        if (!api.isLoggedIn()) {
          api.showToast('Vui lòng đăng nhập tài khoản để tiến hành đặt hàng.', 'info');
          closeCart();
          window.TovangAuth?.openAuthModal('login');
          return;
        }

        // Đã đăng nhập: Mở Checkout Modal
        closeCart();
        window.TovangCheckout?.openCheckout(cartData);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupCartUI();
      loadCart();
    });
  } else {
    setupCartUI();
    loadCart();
  }

  window.TovangCart = {
    loadCart,
    addItem,
    updateItem,
    removeItem,
    openCart,
    closeCart,
    getCartData: () => cartData
  };
})();
