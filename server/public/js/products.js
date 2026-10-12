/**
 * TỔ VÀNG — PRODUCTS.JS
 * Nạp động danh mục sản phẩm từ Backend API v1 & Quản lý Modal Chi Tiết Sản Phẩm (A2)
 */

(function () {
  'use strict';

  const api = window.TovangApi;
  let productsCache = [];
  let currentProduct = null;
  let selectedVariant = null;

  async function loadProducts() {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;

    try {
      const res = await api.get('/api/v1/products');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        productsCache = res.data;
        renderProductsGrid(res.data, grid);
      }
    } catch (err) {
      console.warn('Không thể nạp danh mục động, giữ nguyên fallback:', err.message);
    }
  }

  function renderProductsGrid(products, container) {
    container.innerHTML = '';

    products.forEach((p, index) => {
      const isHero = index === 0;
      const card = document.createElement('div');
      card.className = `product-card ${isHero ? 'product-hero' : ''} fade-in visible`;
      card.setAttribute('data-slug', p.slug);
      card.setAttribute('data-id', p.id);

      const firstVariant = p.variants && p.variants.length > 0 ? p.variants[0] : null;
      const priceText = firstVariant ? api.formatMoney(firstVariant.price) : '250.000đ';
      const variantText = firstVariant ? `/ ${firstVariant.name}` : '';
      const imgUrl = p.primary_image || (p.images && p.images[0]?.url) || 'assets/images/honey-forest-wide.jpg';

      card.innerHTML = `
        <img src="${imgUrl}" alt="${p.name}" class="product-card-img" loading="lazy">
        <div class="product-card-overlay">
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--gold); letter-spacing:0.18em; text-transform:uppercase; margin-bottom:0.4rem;">
            ★ ${p.average_rating || '5.0'} (${p.review_count || 0} thẩm định)
          </div>
          <h3 class="product-name">${p.name}</h3>
          <div class="product-price">${priceText} <span>${variantText}</span></div>
          <button type="button" class="btn-primary btn-quick-view" style="margin-top:1.2rem; padding:0.6rem 1.4rem; font-size:0.68rem;">
            Xem Chi Tiết & Đặt Hàng →
          </button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        e.preventDefault();
        openProductModal(p.slug);
      });

      container.appendChild(card);
    });
  }

  async function openProductModal(slug) {
    const modal = document.getElementById('productDetailModal');
    if (!modal) return;

    try {
      let product = productsCache.find(p => p.slug === slug);
      if (!product || !product.recent_reviews) {
        const res = await api.get(`/api/v1/products/${slug}`);
        if (res.success && res.data) {
          product = res.data;
        }
      }

      if (!product) return;
      currentProduct = product;
      selectedVariant = product.variants && product.variants.length > 0 ? product.variants[0] : null;

      renderProductDetail(product);
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    } catch (err) {
      api.showToast('Không thể xem chi tiết sản phẩm: ' + err.message, 'error');
    }
  }

  function renderProductDetail(p) {
    const imgEl = document.getElementById('detailImg');
    const titleEl = document.getElementById('detailTitle');
    const originTagEl = document.getElementById('detailOriginTag');
    const ratingEl = document.getElementById('detailRating');
    const priceEl = document.getElementById('detailPrice');
    const stockEl = document.getElementById('detailStockBadge');
    const descEl = document.getElementById('detailDesc');
    const variantBox = document.getElementById('detailVariantButtons');
    const qtyInput = document.getElementById('detailQtyInput');

    const imgUrl = (p.images && p.images[0]?.url) || p.primary_image || 'assets/images/honey-forest-wide.jpg';
    if (imgEl) imgEl.src = imgUrl;
    if (titleEl) titleEl.textContent = p.name;
    if (originTagEl) originTagEl.textContent = `Nguồn gốc: ${p.origin || 'Vũ Quang, Hương Khê, Hà Tĩnh'}`;
    if (ratingEl) {
      ratingEl.innerHTML = `★ ${p.average_rating || 5.0} · <span style="color:#7a7268;">(${p.review_count || 0} lượt thẩm định thực tế)</span>`;
    }
    if (descEl) descEl.textContent = p.description || p.short_description || '';
    if (qtyInput) qtyInput.value = 1;

    // Specs table
    document.getElementById('specOrigin').textContent = p.origin || 'Hà Tĩnh, Việt Nam';
    document.getElementById('specIngredients').textContent = p.ingredients || '100% mật ong rừng thô';
    document.getElementById('specShelfLife').textContent = p.shelf_life || '24 tháng';
    document.getElementById('specDeclaration').textContent = p.self_declaration_number || 'CB-1952-HT/2026';
    document.getElementById('specWarning').textContent = p.warning_text || 'Không dùng cho trẻ em dưới 1 tuổi.';

    // Variants
    if (variantBox && p.variants && p.variants.length > 0) {
      variantBox.innerHTML = '';
      p.variants.forEach((v, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `variant-btn ${idx === 0 ? 'active' : ''}`;
        btn.textContent = `${v.name} — ${api.formatMoney(v.price)}`;
        btn.addEventListener('click', () => {
          variantBox.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedVariant = v;
          updateSelectedVariantUI();
        });
        variantBox.appendChild(btn);
      });
      selectedVariant = p.variants[0];
      updateSelectedVariantUI();
    }
  }

  function updateSelectedVariantUI() {
    if (!selectedVariant) return;
    const priceEl = document.getElementById('detailPrice');
    const stockEl = document.getElementById('detailStockBadge');

    if (priceEl) priceEl.textContent = api.formatMoney(selectedVariant.price);
    if (stockEl) {
      if (selectedVariant.stock > 0) {
        stockEl.className = 'detail-stock-badge';
        stockEl.textContent = `Còn hàng (${selectedVariant.stock} sản phẩm sẵn sàng giao)`;
      } else {
        stockEl.className = 'detail-stock-badge out-of-stock';
        stockEl.textContent = 'Tạm hết hàng';
      }
    }
  }

  function setupDetailModalEvents() {
    const modal = document.getElementById('productDetailModal');
    if (!modal) return;

    const closeBtn = document.getElementById('btnCloseProductModal');
    closeBtn?.addEventListener('click', closeProductModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeProductModal();
    });

    // Quantity selectors
    const btnQtyMinus = document.getElementById('btnDetailQtyMinus');
    const btnQtyPlus = document.getElementById('btnDetailQtyPlus');
    const qtyInput = document.getElementById('detailQtyInput');

    btnQtyMinus?.addEventListener('click', () => {
      let val = parseInt(qtyInput.value, 10) || 1;
      if (val > 1) qtyInput.value = val - 1;
    });

    btnQtyPlus?.addEventListener('click', () => {
      let val = parseInt(qtyInput.value, 10) || 1;
      const maxStock = selectedVariant ? selectedVariant.stock : 10;
      if (val < Math.min(10, maxStock)) qtyInput.value = val + 1;
    });

    // Add to cart button
    const btnAddToCart = document.getElementById('btnDetailAddToCart');
    btnAddToCart?.addEventListener('click', async () => {
      if (!selectedVariant) {
        api.showToast('Vui lòng chọn phân loại sản phẩm.', 'error');
        return;
      }
      const qty = parseInt(qtyInput.value, 10) || 1;

      try {
        btnAddToCart.disabled = true;
        btnAddToCart.textContent = 'ĐANG THÊM...';
        await window.TovangCart?.addItem(selectedVariant.id, qty);
        btnAddToCart.disabled = false;
        btnAddToCart.textContent = 'THÊM VÀO GIỎ HÀNG';
        closeProductModal();
        window.TovangCart?.openCart();
      } catch (err) {
        btnAddToCart.disabled = false;
        btnAddToCart.textContent = 'THÊM VÀO GIỎ HÀNG';
        api.showToast(err.message, 'error');
      }
    });
  }

  function closeProductModal() {
    const modal = document.getElementById('productDetailModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Khởi động
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadProducts();
      setupDetailModalEvents();
    });
  } else {
    loadProducts();
    setupDetailModalEvents();
  }

  window.TovangProducts = {
    loadProducts,
    openProductModal,
    closeProductModal
  };
})();
