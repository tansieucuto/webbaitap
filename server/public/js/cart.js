/**
 * TỔ VÀNG — CART.JS
 * Quản lý Giỏ Hàng Toàn Diện: Đồng Bộ LocalStorage + Backend API v1, Drawer & Trang Giỏ Hàng
 */

(function () {
  'use strict';

  const api = window.TovangApi;
  const STORAGE_KEY = 'tovang_cart_cache_v2';

  // Danh mục biến thể dự phòng để tra cứu tức thì khi chưa tải xong từ backend
  const fallbackCatalog = {
    1: { name: 'Mật Ong Rừng Đặc Biệt', variant: 'Hũ Thủy Tinh 500ml', sku: 'MOR-500', price: 280000, img: 'assets/images/honey-forest-wide.jpg' },
    2: { name: 'Mật Ong Rừng Đặc Biệt', variant: 'Chai Rót Cao Cấp 1000ml', sku: 'MOR-1000', price: 520000, img: 'assets/images/honey-forest-wide.jpg' },
    3: { name: 'Mật Ong Hoa Rừng Cổ Thụ', variant: 'Hũ Thủy Tinh 500ml', sku: 'MCT-500', price: 310000, img: 'assets/images/honey-deep-ancient.jpg' },
    4: { name: 'Mật Ong Hoa Rừng Cổ Thụ', variant: 'Hũ Gốm Mộc 750ml', sku: 'MCT-750', price: 460000, img: 'assets/images/honey-deep-ancient.jpg' },
    5: { name: 'Mật Ong Kem Hoa Bạc Hà', variant: 'Hũ Thủy Tinh 380ml', sku: 'MBH-380', price: 295000, img: 'assets/images/honey-creamed-velvet.jpg' },
    6: { name: 'Mật Ong Hoa Cam Rừng', variant: 'Hũ Thủy Tinh 500ml', sku: 'MHC-500', price: 260000, img: 'assets/images/honey-citrus-blossom.jpg' },
    7: { name: 'Mật Ong Rừng Hũ Thủy Tinh', variant: 'Hũ Thủy Tinh 500ml', sku: 'MRH-500', price: 270000, img: 'assets/images/honey-forest-500ml.jpg' },
    8: { name: 'Hộp Quà Mật Ong Thượng Hạng', variant: 'Hộp Quà Gỗ 3 Món', sku: 'HQ-03', price: 580000, img: 'assets/images/honey-gift-box.jpg' }
  };

  let cartData = loadFromStorage() || {
    items: [],
    subtotal: 0,
    shipping_fee: 0,
    total: 0,
    free_shipping_threshold: 500000
  };

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartData));
    } catch (e) {
      console.warn('Lỗi ghi LocalStorage:', e);
    }
  }

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      return null;
    }
    return null;
  }

  function recalculateCart() {
    const threshold = cartData.free_shipping_threshold || 500000;
    let sub = 0;
    (cartData.items || []).forEach(it => {
      it.subtotal = it.price * it.quantity;
      sub += it.subtotal;
    });
    cartData.subtotal = sub;
    cartData.shipping_fee = (sub === 0 || sub >= threshold) ? 0 : 30000;
    cartData.total = sub + cartData.shipping_fee;
    saveToStorage();
  }

  // Nạp giỏ hàng từ API
  async function loadCart() {
    try {
      const res = await api.get('/api/v1/cart');
      if (res && res.success && res.data && Array.isArray(res.data.items)) {
        if (res.data.items.length > 0) {
          cartData = res.data;
          saveToStorage();
        } else if (cartData.items && cartData.items.length > 0) {
          // Server trống nhưng local có sản phẩm: đồng bộ các món từ local lên server
          for (const it of cartData.items) {
            try {
              await api.post('/api/v1/cart/items', {
                variant_id: it.variant_id,
                quantity: it.quantity
              });
            } catch (_) {}
          }
        } else {
          cartData = res.data;
          saveToStorage();
        }
      }
    } catch (err) {
      console.warn('Backend chưa sẵn sàng, dùng giỏ hàng offline cache:', err.message);
    }
    renderCart();
    return cartData;
  }

  // Thêm sản phẩm vào giỏ
  async function addItem(variantId, quantity = 1) {
    const vid = parseInt(variantId, 10);
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    // Cập nhật tức thì vào Local State để người dùng thấy ngay không có độ trễ
    const existingIndex = cartData.items.findIndex(it => it.variant_id === vid);
    if (existingIndex > -1) {
      cartData.items[existingIndex].quantity = Math.min(10, cartData.items[existingIndex].quantity + qty);
    } else {
      const fallback = fallbackCatalog[vid] || {
        name: 'Mật Ong Rừng Hà Tĩnh',
        variant: 'Quy cách chuẩn',
        sku: 'MOR',
        price: 250000,
        img: 'assets/images/honey-forest-wide.jpg'
      };
      cartData.items.push({
        id: Date.now(),
        variant_id: vid,
        product_name: fallback.name,
        variant_name: fallback.variant,
        sku: fallback.sku,
        price: fallback.price,
        quantity: Math.min(10, qty),
        image: fallback.img
      });
    }

    recalculateCart();
    renderCart();
    api.showToast('✓ Đã thêm sản phẩm vào giỏ hàng!', 'success');

    // Đồng bộ với API Backend
    try {
      const res = await api.post('/api/v1/cart/items', {
        variant_id: vid,
        quantity: qty
      });
      if (res && res.success && res.data && Array.isArray(res.data.items)) {
        cartData = res.data;
        saveToStorage();
        renderCart();
      }
    } catch (err) {
      console.warn('Đồng bộ backend sau khi thêm món:', err.message);
    }

    return cartData;
  }

  // Cập nhật số lượng
  async function updateItem(itemId, quantity) {
    const qty = parseInt(quantity, 10);
    const itIndex = cartData.items.findIndex(i => i.id == itemId || i.variant_id == itemId);

    if (itIndex > -1) {
      if (qty <= 0) {
        cartData.items.splice(itIndex, 1);
        api.showToast('Đã xóa sản phẩm khỏi giỏ hàng.', 'info');
      } else {
        cartData.items[itIndex].quantity = Math.min(10, qty);
      }
      recalculateCart();
      renderCart();
    }

    try {
      const res = await api.patch(`/api/v1/cart/items/${itemId}`, { quantity: qty });
      if (res && res.success && res.data && Array.isArray(res.data.items)) {
        cartData = res.data;
        saveToStorage();
        renderCart();
      }
    } catch (err) {
      console.warn('Đồng bộ backend sau khi sửa số lượng:', err.message);
    }
  }

  // Xóa sản phẩm
  async function removeItem(itemId) {
    const itIndex = cartData.items.findIndex(i => i.id == itemId || i.variant_id == itemId);
    if (itIndex > -1) {
      cartData.items.splice(itIndex, 1);
      recalculateCart();
      renderCart();
      api.showToast('Đã xóa sản phẩm khỏi giỏ hàng.', 'info');
    }

    try {
      const res = await api.delete(`/api/v1/cart/items/${itemId}`);
      if (res && res.success && res.data && Array.isArray(res.data.items)) {
        cartData = res.data;
        saveToStorage();
        renderCart();
      }
    } catch (err) {
      console.warn('Đồng bộ backend sau khi xóa:', err.message);
    }
  }

  // Render giỏ hàng vào badge & drawer
  function renderCart() {
    const totalCount = (cartData.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);

    // Cập nhật badge trên thanh điều hướng
    document.querySelectorAll('.cart-badge, #cartBadge').forEach(el => {
      el.textContent = totalCount;
    });

    // Cập nhật drawer nếu có trên trang
    const cartBody = document.getElementById('cartDrawerBody');
    const subtotalEl = document.getElementById('cartSubtotal');
    const shippingProgress = document.getElementById('cartShippingProgress');
    const shippingNotice = document.getElementById('cartShippingNotice');

    if (cartBody) {
      if (!cartData.items || cartData.items.length === 0) {
        cartBody.innerHTML = `
          <div class="cart-empty" style="text-align:center; padding: 3rem 1rem;">
            <span class="cart-empty-tag" style="color:var(--gold); font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.2em;">[ DANH MỤC TRỐNG ]</span>
            <h4 style="font-family:var(--font-serif); font-size:1.3rem; margin:1rem 0 0.5rem; color:var(--ink);">Giỏ Hàng Chưa Có Sản Phẩm</h4>
            <p style="font-size:0.8rem; color:#777; line-height:1.7; max-width:320px; margin:0 auto 1.5rem;">
              Vui lòng chọn các dòng mật ong rừng nguyên bản từ bộ sưu tập để tiếp tục đặt hàng.
            </p>
            <a href="products.html" class="btn-primary" style="display:inline-block; font-size:0.72rem; padding:0.6rem 1.4rem;">Xem Sản Phẩm</a>
          </div>
        `;
        if (subtotalEl) subtotalEl.textContent = '0đ';
        if (shippingProgress) shippingProgress.style.width = '0%';
        if (shippingNotice) shippingNotice.textContent = 'Mua thêm 500.000đ để được miễn phí vận chuyển';
      } else {
        let html = '';
        cartData.items.forEach(it => {
          const priceFormatted = api.formatMoney(it.price);
          html += `
            <div class="cart-item" data-id="${it.id || it.variant_id}">
              <div class="cart-item-code">${it.sku || 'MOR'}</div>
              <div class="cart-item-details">
                <div class="cart-item-name">${it.product_name}</div>
                <div class="cart-item-price">${it.variant_name} · ${priceFormatted}</div>
                <div class="cart-item-qty">
                  <button type="button" class="qty-btn btn-qty-dec" data-id="${it.id || it.variant_id}" data-qty="${it.quantity - 1}">-</button>
                  <span style="font-size:0.75rem; font-family:var(--font-mono); font-weight:bold; min-width:24px; text-align:center;">${it.quantity}</span>
                  <button type="button" class="qty-btn btn-qty-inc" data-id="${it.id || it.variant_id}" data-qty="${it.quantity + 1}">+</button>
                </div>
              </div>
              <button type="button" class="cart-item-remove btn-item-del" data-id="${it.id || it.variant_id}" title="Xóa">[ XÓA ]</button>
            </div>
          `;
        });
        cartBody.innerHTML = html;

        // Gắn sự kiện tăng / giảm / xóa trong drawer
        cartBody.querySelectorAll('.btn-qty-dec').forEach(b => {
          b.addEventListener('click', () => updateItem(b.getAttribute('data-id'), parseInt(b.getAttribute('data-qty'), 10)));
        });
        cartBody.querySelectorAll('.btn-qty-inc').forEach(b => {
          b.addEventListener('click', () => updateItem(b.getAttribute('data-id'), parseInt(b.getAttribute('data-qty'), 10)));
        });
        cartBody.querySelectorAll('.btn-item-del').forEach(b => {
          b.addEventListener('click', () => removeItem(b.getAttribute('data-id')));
        });

        if (subtotalEl) {
          subtotalEl.textContent = api.formatMoney(cartData.subtotal);
        }

        // Thanh tiến độ Free Shipping
        if (shippingProgress && shippingNotice) {
          const threshold = cartData.free_shipping_threshold || 500000;
          const percent = Math.min(100, Math.round((cartData.subtotal / threshold) * 100));
          shippingProgress.style.width = `${percent}%`;

          if (cartData.subtotal >= threshold) {
            shippingNotice.innerHTML = '<strong style="color:#2e7d32;">✓ Đủ điều kiện Miễn phí giao hàng toàn quốc</strong>';
          } else {
            const remaining = threshold - cartData.subtotal;
            shippingNotice.textContent = `Mua thêm ${api.formatMoney(remaining)} để được miễn phí vận chuyển`;
          }
        }
      }
    }

    // Nếu đang ở trang cart.html, phát sự kiện để trang giỏ hàng cập nhật
    window.dispatchEvent(new CustomEvent('tovang_cart_updated', { detail: cartData }));
  }

  function openCart() {
    const overlay = document.getElementById('cartDrawerOverlay');
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    } else {
      // Nếu trang không có drawer, điều hướng sang trang giỏ hàng
      window.location.href = 'cart.html';
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
    const isCartPage = window.location.pathname.endsWith('cart.html');

    // Nút Giỏ Hàng trên navbar:
    // Nếu có Drawer trên trang và không phải trang cart.html: Mở drawer
    // Nếu là trang cart.html: không làm gì
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        if (isCartPage) {
          // Đang ở cart.html rồi
          return;
        }
        if (overlay) {
          e.preventDefault();
          renderCart();
          openCart();
          loadCart();
        }
        // Nếu không có overlay thì để link tự nhiên dẫn về cart.html
      });
    }

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

        // Mở Checkout Modal
        closeCart();
        window.TovangCheckout?.openCheckout(cartData);
      });
    }
  }

  // Khởi động
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupCartUI();
      renderCart();
      loadCart();
    });
  } else {
    setupCartUI();
    renderCart();
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
