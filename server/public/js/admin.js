/**
 * TỔ VÀNG — ADMIN.JS
 * Dashboard · Đơn hàng · Kho (ẩn/xóa sản phẩm) · Khách hàng · Đánh giá · Thêm sản phẩm + upload ảnh
 */

(function () {
  'use strict';

  const api = window.TovangApi;

  const STATUS_LABELS = {
    pending_payment: 'Chờ thanh toán',
    pending_confirmation: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipping: 'Đang giao',
    delivered: 'Đã giao',
    delivery_failed: 'Giao thất bại',
    cancelled: 'Đã hủy',
    expired: 'Hết hạn thanh toán',
    refunded: 'Đã hoàn tiền'
  };

  // Escape HTML — mọi dữ liệu người dùng phải qua đây trước khi vào innerHTML (chống stored XSS)
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function stars(rating) {
    const n = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function fmtDate(str, withTime) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', withTime
      ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // ===== ĐIỀU HƯỚNG TAB (modal admin trên trang chủ) =====
  function switchAdminTab(tabName) {
    const modal = document.getElementById('adminModal');
    if (!modal) return;

    modal.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    ['Dashboard', 'Orders', 'Inventory'].forEach(name => {
      const el = document.getElementById('adminTab' + name);
      if (el) el.style.display = (name.toLowerCase() === tabName) ? 'block' : 'none';
    });
  }

  async function openDashboard() {
    const modal = document.getElementById('adminModal');
    if (!modal) return;

    if (!api.isAdmin()) {
      api.showToast('Bạn không có quyền truy cập khu vực quản trị.', 'error');
      return;
    }

    switchAdminTab('dashboard');
    await loadAdminDashboard();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // ===== DASHBOARD =====
  async function loadAdminDashboard() {
    try {
      const res = await api.get('/api/v1/admin/dashboard');
      if (!res.success || !res.data) return;

      const d = res.data;
      const statusCounts = d.statusCounts || {};
      const totalOrdersCount = Object.values(statusCounts).reduce((a, b) => a + (b || 0), 0);

      setText('adminTotalRev', api.formatMoney(d.totalRevenue || 0));
      setText('adminTotalOrders', totalOrdersCount);
      setText('adminPendingOrders', (statusCounts.pending_payment || 0) + (statusCounts.pending_confirmation || 0));
      setText('adminLowStockCount', (d.lowStockVariants || []).length);
      setText('adminCustomerCount', d.customerCount || 0);
      setText('adminPendingReviewsCount', d.pendingReviewCount || 0);
      setText('adminProductCount', d.productCount || 0);

      const stockTableBody = document.getElementById('adminLowStockTable');
      if (stockTableBody) {
        if (!d.lowStockVariants || d.lowStockVariants.length === 0) {
          stockTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#2e7d32; padding:1.2rem;">Tất cả các loại sản phẩm đều đủ tồn kho an toàn.</td></tr>';
        } else {
          stockTableBody.innerHTML = d.lowStockVariants.map(item => `
            <tr>
              <td><strong>${esc(item.product_name)}</strong></td>
              <td>${esc(item.variant_name)} (${esc(item.sku)})</td>
              <td style="color:var(--rust); font-weight:bold;">${parseInt(item.stock, 10) || 0} sản phẩm</td>
              <td>${api.formatMoney(item.price)}</td>
            </tr>`).join('');
        }
      }

      const recentBody = document.getElementById('adminRecentOrdersTable');
      if (recentBody) {
        const rows = (d.recentOrders || []).map(o => `
          <tr>
            <td><strong>${esc(o.order_code)}</strong></td>
            <td>${esc(o.recipient_name)} (${esc(o.phone)})</td>
            <td>${api.formatMoney(o.total)}</td>
            <td><span class="status-badge ${esc(o.status)}">${STATUS_LABELS[o.status] || esc(o.status)}</span></td>
          </tr>`).join('');
        recentBody.innerHTML = rows || '<tr><td colspan="4" style="text-align:center;">Chưa có đơn hàng nào.</td></tr>';
      }
    } catch (err) {
      api.showToast('Không thể nạp bảng điều khiển: ' + err.message, 'error');
    }
  }

  // ===== ĐƠN HÀNG =====
  async function loadAdminOrders(statusFilter = '') {
    const listBody = document.getElementById('adminOrdersTable');
    if (!listBody) return;

    listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">Đang tải đơn hàng...</td></tr>';

    try {
      const url = statusFilter
        ? `/api/v1/admin/orders?status=${encodeURIComponent(statusFilter)}`
        : '/api/v1/admin/orders';
      const res = await api.get(url);

      if (!res.success || !res.data || res.data.length === 0) {
        listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#888;">Không có đơn hàng nào phù hợp bộ lọc.</td></tr>';
        return;
      }

      let rows = '';
      res.data.forEach(order => {
        const canConfirmPay = order.status === 'pending_payment';
        const canConfirmCod = order.status === 'pending_confirmation';
        const canShip = order.status === 'confirmed';
        const canDeliver = order.status === 'shipping';
        const canCancel = ['pending_payment', 'pending_confirmation', 'confirmed', 'shipping', 'delivery_failed'].includes(order.status);

        let actions = '<div style="display:flex; gap:0.4rem; flex-wrap:wrap;">';
        if (canConfirmPay) actions += `<button type="button" class="btn-small btn-status-change" data-code="${esc(order.order_code)}" data-status="confirmed" title="Xác nhận đã nhận chuyển khoản">Đã Nhận Tiền</button>`;
        if (canConfirmCod) actions += `<button type="button" class="btn-small btn-status-change" data-code="${esc(order.order_code)}" data-status="confirmed" title="Xác nhận đơn">Xác Nhận Đơn</button>`;
        if (canShip) actions += `<button type="button" class="btn-small btn-status-ship" data-code="${esc(order.order_code)}" title="Nhập mã vận đơn và giao hàng">Giao Hàng</button>`;
        if (canDeliver) actions += `<button type="button" class="btn-small btn-status-change" data-code="${esc(order.order_code)}" data-status="delivered" title="Hoàn tất đơn hàng">Đã Giao</button>`;
        if (canCancel) actions += `<button type="button" class="btn-small btn-small-danger btn-status-change" data-code="${esc(order.order_code)}" data-status="cancelled" title="Hủy đơn & hoàn kho">Hủy Đơn</button>`;
        actions += '</div>';

        const itemsSummary = (order.items || [])
          .map(i => `${esc(i.product_name)} (${esc(i.variant_name)}) x${i.quantity}`)
          .join(', ');
        const paymentLabel = { cod: 'COD', bank_transfer: 'VietQR', vnpay: 'VNPay' }[order.payment_method] || order.payment_method;

        rows += `
          <tr>
            <td>
              <strong>${esc(order.order_code)}</strong>
              <div style="font-size:0.65rem; color:#888;">${fmtDate(order.created_at)} · ${esc(paymentLabel)}</div>
            </td>
            <td>
              <div><strong>${esc(order.recipient_name)}</strong> · ${esc(order.phone)}</div>
              <div style="font-size:0.65rem; color:#666;">${esc(order.full_address)}</div>
            </td>
            <td style="max-width:200px; font-size:0.68rem; color:#444;">${itemsSummary}</td>
            <td style="font-weight:700; color:var(--rust);">${api.formatMoney(order.total)}</td>
            <td><span class="status-badge ${esc(order.status)}">${STATUS_LABELS[order.status] || esc(order.status)}</span></td>
            <td>${actions}</td>
          </tr>`;
      });

      listBody.innerHTML = rows;

      listBody.querySelectorAll('.btn-status-change').forEach(b => {
        b.addEventListener('click', async () => {
          const code = b.getAttribute('data-code');
          const status = b.getAttribute('data-status');
          if (confirm(`Chuyển trạng thái đơn ${code} thành "${STATUS_LABELS[status] || status}"?`)) {
            try {
              await api.patch(`/api/v1/admin/orders/${encodeURIComponent(code)}/status`, { status });
              api.showToast(`Đã cập nhật đơn ${code} thành "${STATUS_LABELS[status]}".`, 'success');
              loadAdminOrders(statusFilter);
              loadAdminDashboard();
            } catch (err) {
              api.showToast(err.message, 'error');
            }
          }
        });
      });

      listBody.querySelectorAll('.btn-status-ship').forEach(b => {
        b.addEventListener('click', async () => {
          const code = b.getAttribute('data-code');
          const tracking = prompt(`Nhập mã vận đơn (Viettel Post / GHTK) cho đơn ${code}:`, 'VNPOST-' + Math.floor(100000 + Math.random() * 900000));
          if (tracking !== null) {
            try {
              await api.patch(`/api/v1/admin/orders/${encodeURIComponent(code)}/status`, { status: 'shipping', tracking_number: tracking });
              api.showToast(`Đơn ${code} đã chuyển sang "Đang giao" với mã vận đơn: ${tracking}`, 'success');
              loadAdminOrders(statusFilter);
              loadAdminDashboard();
            } catch (err) {
              api.showToast(err.message, 'error');
            }
          }
        });
      });
    } catch (err) {
      listBody.innerHTML = `<tr><td colspan="6" style="color:var(--rust); text-align:center;">Lỗi nạp đơn: ${esc(err.message)}</td></tr>`;
    }
  }

  // ===== KHO HÀNG =====
  async function loadAdminInventory() {
    const tableBody = document.getElementById('adminInventoryTable');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải danh sách kho...</td></tr>';

    try {
      const res = await api.get('/api/v1/admin/products');
      if (!res.success || !res.data) return;

      let rows = '';
      res.data.forEach(p => {
        const variants = p.variants || [];
        const active = !!p.is_active;

        variants.forEach((v, idx) => {
          rows += `
            <tr${active ? '' : ' style="opacity:0.55;"'}>
              <td>
                <strong>${esc(p.name)}</strong>
                <div style="margin-top:0.25rem;">
                  <span class="status-badge ${active ? 'delivered' : 'cancelled'}">${active ? 'Đang bán' : 'Đã ẩn'}</span>
                </div>
              </td>
              <td>${esc(v.name)}</td>
              <td><code>${esc(v.sku)}</code></td>
              <td><input type="number" class="form-input inv-stock-input" value="${parseInt(v.stock, 10) || 0}" data-pid="${p.id}" data-vid="${v.id}" style="width:90px; padding:0.4rem;" min="0"></td>
              <td><input type="number" class="form-input inv-price-input" value="${parseInt(v.price, 10) || 0}" data-pid="${p.id}" data-vid="${v.id}" style="width:130px; padding:0.4rem;" step="1000" min="1000"></td>
              <td>
                ${idx === 0 ? `
                  <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                    <button type="button" class="btn-small btn-product-toggle" data-id="${p.id}" data-active="${active ? '1' : '0'}">${active ? 'Ẩn' : 'Hiện'}</button>
                    <button type="button" class="btn-small btn-small-danger btn-product-delete" data-id="${p.id}" data-name="${esc(p.name)}">🗑 Xóa</button>
                  </div>` : ''}
              </td>
            </tr>`;
        });
      });

      if (!rows) {
        rows = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#888;">Chưa có sản phẩm nào — bấm "＋ Thêm Sản Phẩm Mới" để bắt đầu.</td></tr>';
      }

      rows += `
        <tr>
          <td colspan="6" style="text-align:right; padding:1.2rem;">
            <button type="button" class="btn-primary" id="btnSaveInventory" style="padding:0.6rem 1.4rem;">Lưu Cập Nhật Kho Hàng</button>
          </td>
        </tr>`;

      tableBody.innerHTML = rows;

      document.getElementById('btnSaveInventory')?.addEventListener('click', async () => {
        const stockInputs = tableBody.querySelectorAll('.inv-stock-input');
        const priceInputs = tableBody.querySelectorAll('.inv-price-input');
        const btn = document.getElementById('btnSaveInventory');
        try {
          btn.disabled = true;
          btn.textContent = 'ĐANG LƯU...';
          for (let i = 0; i < stockInputs.length; i++) {
            const pid = stockInputs[i].getAttribute('data-pid');
            const vid = stockInputs[i].getAttribute('data-vid');
            const stock = parseInt(stockInputs[i].value, 10);
            const price = parseInt(priceInputs[i].value, 10);
            if (isNaN(stock) || stock < 0 || isNaN(price) || price <= 0) {
              throw new Error('Tồn kho / giá không hợp lệ ở một dòng — kiểm tra lại.');
            }
            await api.patch(`/api/v1/admin/products/${pid}/variants`, { variant_id: Number(vid), stock, price });
          }
          api.showToast('Cập nhật tồn kho và giá thành công!', 'success');
          loadAdminInventory();
          window.TovangProducts?.loadProducts();
        } catch (err) {
          api.showToast('Lỗi lưu kho: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Lưu Cập Nhật Kho Hàng';
        }
      });

      // Ẩn / Hiện sản phẩm khỏi cửa hàng
      tableBody.querySelectorAll('.btn-product-toggle').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          const isActive = b.getAttribute('data-active') === '1';
          b.disabled = true;
          try {
            await api.patch(`/api/v1/admin/products/${id}`, { is_active: !isActive });
            api.showToast(isActive ? 'Đã ẩn sản phẩm khỏi cửa hàng.' : 'Đã hiện lại sản phẩm.', 'success');
            loadAdminInventory();
            window.TovangProducts?.loadProducts();
          } catch (err) {
            b.disabled = false;
            api.showToast(err.message, 'error');
          }
        });
      });

      // Xóa sản phẩm (chặn nếu đã có đơn hàng)
      tableBody.querySelectorAll('.btn-product-delete').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          const name = b.getAttribute('data-name');
          if (!confirm(`Xóa vĩnh viễn sản phẩm "${name}"?\n\nNếu sản phẩm đã có đơn hàng, hệ thống sẽ chặn và đề nghị dùng nút Ẩn.`)) return;
          b.disabled = true;
          try {
            const res = await api.delete(`/api/v1/admin/products/${id}`);
            api.showToast(res.message || 'Đã xóa sản phẩm.', 'success');
            loadAdminInventory();
            window.TovangProducts?.loadProducts();
          } catch (err) {
            b.disabled = false;
            api.showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="6" style="color:var(--rust); text-align:center;">Lỗi nạp tồn kho: ${esc(err.message)}</td></tr>`;
    }
  }

  // ===== ĐÁNH GIÁ =====
  async function loadAdminReviews(statusFilter = '') {
    const tbody = document.getElementById('adminReviewsTable');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem;">Đang tải đánh giá...</td></tr>';

    try {
      const url = statusFilter
        ? `/api/v1/admin/reviews?status=${encodeURIComponent(statusFilter)}`
        : '/api/v1/admin/reviews';
      const res = await api.get(url);

      if (!res.success || !res.data || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#888;">Chưa có đánh giá nào.</td></tr>';
        return;
      }

      tbody.innerHTML = res.data.map(r => {
        const approved = !!r.is_approved;
        return `
          <tr>
            <td><strong>${esc(r.product_name)}</strong><div style="font-size:0.65rem; color:#888;">Đơn: ${esc(r.order_code || '—')}</div></td>
            <td>${esc(r.author_name)}<div style="font-size:0.65rem; color:#888;">${esc(r.author_email)}</div></td>
            <td style="color:var(--gold); white-space:nowrap;">${stars(r.rating)}</td>
            <td style="max-width:320px; font-size:0.75rem;">${esc(r.content)}</td>
            <td style="font-size:0.7rem;">${fmtDate(r.created_at, true)}</td>
            <td><span class="status-badge ${approved ? 'delivered' : 'pending_confirmation'}">${approved ? 'Đã duyệt' : 'Chờ duyệt'}</span></td>
            <td>
              ${approved
                ? `<button type="button" class="btn-small btn-small-danger btn-review-toggle" data-id="${r.id}" data-approve="0">Ẩn</button>`
                : `<button type="button" class="btn-small btn-review-toggle" data-id="${r.id}" data-approve="1" style="color:#2e7d32; font-weight:600;">✓ Duyệt</button>`}
            </td>
          </tr>`;
      }).join('');

      tbody.querySelectorAll('.btn-review-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const approve = btn.getAttribute('data-approve') === '1';
          btn.disabled = true;
          try {
            await api.patch(`/api/v1/admin/reviews/${id}`, { is_approved: approve });
            api.showToast(approve ? 'Đã duyệt đánh giá.' : 'Đã ẩn đánh giá.', 'success');
            loadAdminReviews(statusFilter);
            loadAdminDashboard();
          } catch (err) {
            btn.disabled = false;
            api.showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--rust); text-align:center;">Lỗi nạp đánh giá: ${esc(err.message)}</td></tr>`;
    }
  }

  // ===== THÊM SẢN PHẨM =====
  function addVariantRow() {
    const container = document.getElementById('productVariantsContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'variant-row';
    row.style.cssText = 'display:grid; grid-template-columns:1.4fr 1fr 1fr 0.8fr auto; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
    row.innerHTML = `
      <input type="text" class="form-input v-name" placeholder="Tên biến thể (vd: Hũ 500ml)" maxlength="255">
      <input type="text" class="form-input v-sku" placeholder="SKU (vd: MOR-500)" maxlength="100">
      <input type="number" class="form-input v-price" placeholder="Giá (VNĐ)" min="1000" step="1000">
      <input type="number" class="form-input v-stock" placeholder="Tồn kho" min="0" value="10">
      <button type="button" class="btn-small btn-small-danger btn-remove-variant" title="Xóa dòng">✕</button>
    `;
    row.querySelector('.btn-remove-variant').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  function openProductModal() {
    const modal = document.getElementById('adminProductModal');
    if (!modal) return;

    document.getElementById('productForm')?.reset();
    const container = document.getElementById('productVariantsContainer');
    if (container) container.innerHTML = '';
    addVariantRow();

    const msg = document.getElementById('productFormMsg');
    if (msg) msg.style.display = 'none';

    const imgPreview = document.getElementById('productImagePreview');
    if (imgPreview) { imgPreview.style.display = 'none'; imgPreview.src = ''; }
    const imgStatus = document.getElementById('productImageStatus');
    if (imgStatus) imgStatus.style.display = 'none';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    const modal = document.getElementById('adminProductModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  async function submitProductForm(e) {
    e.preventDefault();

    const msgEl = document.getElementById('productFormMsg');
    const showMsg = (text, type) => {
      if (!msgEl) return;
      msgEl.className = 'form-message ' + type;
      msgEl.textContent = text;
      msgEl.style.display = 'block';
    };

    const name = document.getElementById('prodNameInput').value.trim();
    if (name.length < 3) return showMsg('Tên sản phẩm phải từ 3 ký tự.', 'error');

    const variants = [];
    document.querySelectorAll('#productVariantsContainer .variant-row').forEach(row => {
      const vName = row.querySelector('.v-name').value.trim();
      const sku = row.querySelector('.v-sku').value.trim();
      const price = parseInt(row.querySelector('.v-price').value, 10);
      const stock = parseInt(row.querySelector('.v-stock').value, 10) || 0;
      if (vName || sku) variants.push({ name: vName, sku, price, stock });
    });

    if (variants.length === 0) return showMsg('Cần ít nhất một biến thể (tên + SKU + giá).', 'error');
    for (const v of variants) {
      if (!v.name || !v.sku) return showMsg('Mỗi biến thể phải có đủ tên và SKU.', 'error');
      if (!v.price || v.price <= 0) return showMsg(`Giá của "${v.name}" không hợp lệ.`, 'error');
    }

    const payload = {
      name,
      short_description: document.getElementById('prodShortDescInput').value.trim(),
      description: document.getElementById('prodDescInput').value.trim(),
      origin: document.getElementById('prodOriginInput').value.trim(),
      ingredients: document.getElementById('prodIngredientsInput').value.trim(),
      shelf_life: document.getElementById('prodShelfLifeInput').value.trim(),
      self_declaration_number: document.getElementById('prodDeclarationInput').value.trim(),
      warning_text: document.getElementById('prodWarningInput').value.trim(),
      image_url: document.getElementById('prodImageInput').value.trim(),
      variants
    };

    const btn = document.getElementById('btnSubmitProduct');
    try {
      btn.disabled = true;
      btn.textContent = 'ĐANG LƯU...';
      const res = await api.post('/api/v1/admin/products', payload);
      api.showToast(res.message || 'Đã thêm sản phẩm.', 'success');
      closeProductModal();
      loadAdminInventory();
      window.TovangProducts?.loadProducts();
    } catch (err) {
      showMsg(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'LƯU SẢN PHẨM';
    }
  }

  // ===== UPLOAD ẢNH SẢN PHẨM (kéo & thả hoặc chọn file) =====
  async function uploadProductImage(file) {
    const statusEl = document.getElementById('productImageStatus');
    const previewEl = document.getElementById('productImagePreview');
    const inputEl = document.getElementById('prodImageInput');

    const setStatus = (text, color) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.style.color = color;
      statusEl.style.display = 'block';
    };

    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return setStatus('❌ Chỉ chấp nhận ảnh JPG / PNG / WebP.', '#c62828');
    }
    if (file.size > 3 * 1024 * 1024) {
      return setStatus('❌ Ảnh vượt quá 3MB.', '#c62828');
    }

    setStatus('⏳ Đang tải ảnh lên...', '#7a7268');

    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/api/v1/admin/uploads/product-image', formData);
      if (res.success && res.data?.url) {
        if (inputEl) inputEl.value = res.data.url;
        if (previewEl) { previewEl.src = res.data.url; previewEl.style.display = 'block'; }
        setStatus('✅ Tải ảnh lên thành công!', '#2e7d32');
      }
    } catch (err) {
      setStatus('❌ ' + err.message, '#c62828');
    }
  }

  function setupProductImageDropzone() {
    const dropzone = document.getElementById('productImageDropzone');
    const fileInput = document.getElementById('productImageFileInput');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => uploadProductImage(fileInput.files?.[0]));

    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--rust)';
        dropzone.style.background = '#fff7ef';
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#c8c0b2';
        dropzone.style.background = '#fff';
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadProductImage(file);
    });
  }

  // ===== KHỞI TẠO UI =====
  function setupAdminUI() {
    const modal = document.getElementById('adminModal');
    const closeBtn = document.getElementById('btnCloseAdminModal');

    closeBtn?.addEventListener('click', closeAdminModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeAdminModal(); });

    modal?.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchAdminTab(tab);
        if (tab === 'dashboard') loadAdminDashboard();
        if (tab === 'orders') loadAdminOrders();
        if (tab === 'inventory') loadAdminInventory();
      });
    });

    setupProductImageDropzone();

    document.getElementById('adminOrderStatusSelect')?.addEventListener('change', (e) => loadAdminOrders(e.target.value));

    document.getElementById('adminOrderSearchInput')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#adminOrdersTable tr').forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(query) ? '' : 'none';
      });
    });

    document.getElementById('adminReviewStatusSelect')?.addEventListener('change', (e) => loadAdminReviews(e.target.value));

    document.getElementById('btnOpenProductModal')?.addEventListener('click', openProductModal);
    document.getElementById('btnCloseProductModal')?.addEventListener('click', closeProductModal);
    document.getElementById('btnCancelProduct')?.addEventListener('click', closeProductModal);
    document.getElementById('btnAddVariantRow')?.addEventListener('click', addVariantRow);
    document.getElementById('productForm')?.addEventListener('submit', submitProductForm);
    document.getElementById('adminProductModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'adminProductModal') closeProductModal();
    });
  }

  function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAdminUI);
  } else {
    setupAdminUI();
  }

  window.TovangAdmin = {
    openDashboard,
    closeAdminModal,
    loadAdminDashboard,
    loadAdminOrders,
    loadAdminInventory,
    loadAdminReviews,
    openProductModal,
    closeProductModal
  };
})();
