/**
 * TỔ VÀNG — ADMIN.JS
 * Quản trị Dashboard (E1), Quản lý Đơn hàng (E3, E4) & Tồn kho sản phẩm (E2)
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
    refunded: 'Đã hoàn tiền'
  };

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

  function switchAdminTab(tabName) {
    const modal = document.getElementById('adminModal');
    if (!modal) return;

    modal.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.getElementById('adminTabDashboard').style.display = tabName === 'dashboard' ? 'block' : 'none';
    document.getElementById('adminTabOrders').style.display = tabName === 'orders' ? 'block' : 'none';
    document.getElementById('adminTabInventory').style.display = tabName === 'inventory' ? 'block' : 'none';
  }

  async function loadAdminDashboard() {
    try {
      const res = await api.get('/api/v1/admin/dashboard');
      if (!res.success || !res.data) return;

      const { totalRevenue, statusCounts, lowStockVariants, recentOrders } = res.data;

      // Cập nhật các thẻ số liệu
      document.getElementById('adminTotalRev').textContent = api.formatMoney(totalRevenue || 0);
      
      const totalOrdersCount = Object.values(statusCounts || {}).reduce((a, b) => a + b, 0);
      document.getElementById('adminTotalOrders').textContent = totalOrdersCount;
      document.getElementById('adminPendingOrders').textContent = (statusCounts?.pending_payment || 0) + (statusCounts?.pending_confirmation || 0);
      document.getElementById('adminLowStockCount').textContent = (lowStockVariants || []).length;

      // Render danh sách cảnh báo tồn kho
      const stockTableBody = document.getElementById('adminLowStockTable');
      if (stockTableBody) {
        if (!lowStockVariants || lowStockVariants.length === 0) {
          stockTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#2e7d32; padding:1.2rem;">Tất cả các loại sản phẩm đều đủ tồn kho an toàn.</td></tr>';
        } else {
          let rows = '';
          lowStockVariants.forEach(item => {
            rows += `
              <tr>
                <td><strong>${item.product_name}</strong></td>
                <td>${item.variant_name} (${item.sku})</td>
                <td style="color:var(--rust); font-weight:bold;">${item.stock} chai</td>
                <td>${api.formatMoney(item.price)}</td>
              </tr>
            `;
          });
          stockTableBody.innerHTML = rows;
        }
      }

      // Render đơn gần đây
      const recentBody = document.getElementById('adminRecentOrdersTable');
      if (recentBody) {
        let rows = '';
        (recentOrders || []).forEach(o => {
          rows += `
            <tr>
              <td><strong>${o.order_code}</strong></td>
              <td>${o.recipient_name} (${o.phone})</td>
              <td>${api.formatMoney(o.total)}</td>
              <td><span class="status-badge ${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
            </tr>
          `;
        });
        recentBody.innerHTML = rows || '<tr><td colspan="4" style="text-align:center;">Chưa có đơn hàng nào.</td></tr>';
      }

    } catch (err) {
      api.showToast('Không thể nạp bảng điều khiển: ' + err.message, 'error');
    }
  }

  async function loadAdminOrders(statusFilter = '') {
    const listBody = document.getElementById('adminOrdersTable');
    if (!listBody) return;

    listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">Đang tải đơn hàng...</td></tr>';

    try {
      const url = statusFilter ? `/api/v1/admin/orders?status=${statusFilter}` : '/api/v1/admin/orders';
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
        const canCancel = !['delivered', 'cancelled', 'refunded'].includes(order.status);

        let actions = '<div style="display:flex; gap:0.4rem; flex-wrap:wrap;">';

        if (canConfirmPay) {
          actions += `<button type="button" class="btn-small btn-status-change" data-code="${order.order_code}" data-status="confirmed" title="Xác nhận đã nhận chuyển khoản">Đã Nhận Tiền</button>`;
        }
        if (canConfirmCod) {
          actions += `<button type="button" class="btn-small btn-status-change" data-code="${order.order_code}" data-status="confirmed" title="Xác nhận đơn">Xác Nhận Đơn</button>`;
        }
        if (canShip) {
          actions += `<button type="button" class="btn-small btn-status-ship" data-code="${order.order_code}" title="Nhập mã vận đơn và giao hàng">Giao Hàng</button>`;
        }
        if (canDeliver) {
          actions += `<button type="button" class="btn-small btn-status-change" data-code="${order.order_code}" data-status="delivered" title="Hoàn tất đơn hàng">Đã Giao</button>`;
        }
        if (canCancel) {
          actions += `<button type="button" class="btn-small btn-small-danger btn-status-change" data-code="${order.order_code}" data-status="cancelled" title="Hủy đơn & hoàn kho">Hủy Đơn</button>`;
        }

        actions += '</div>';

        const itemsSummary = (order.items || []).map(i => `${i.product_name} (${i.variant_name}) x${i.quantity}`).join(', ');

        rows += `
          <tr>
            <td>
              <strong>${order.order_code}</strong>
              <div style="font-size:0.65rem; color:#888;">${new Date(order.created_at).toLocaleDateString('vi-VN')}</div>
            </td>
            <td>
              <div><strong>${order.recipient_name}</strong> · ${order.phone}</div>
              <div style="font-size:0.65rem; color:#666;">${order.full_address}</div>
            </td>
            <td style="max-width:200px; font-size:0.68rem; color:#444;">${itemsSummary}</td>
            <td style="font-weight:700; color:var(--rust);">${api.formatMoney(order.total)}</td>
            <td><span class="status-badge ${order.status}">${STATUS_LABELS[order.status] || order.status}</span></td>
            <td>${actions}</td>
          </tr>
        `;
      });

      listBody.innerHTML = rows;

      // Gắn sự kiện chuyển trạng thái
      listBody.querySelectorAll('.btn-status-change').forEach(b => {
        b.addEventListener('click', async () => {
          const code = b.getAttribute('data-code');
          const status = b.getAttribute('data-status');
          if (confirm(`Chuyển trạng thái đơn ${code} thành "${STATUS_LABELS[status] || status}"?`)) {
            try {
              await api.patch(`/api/v1/admin/orders/${code}/status`, { status });
              api.showToast(`Đã cập nhật đơn ${code} thành "${STATUS_LABELS[status]}".`, 'success');
              loadAdminOrders(statusFilter);
            } catch (err) {
              api.showToast(err.message, 'error');
            }
          }
        });
      });

      // Giao hàng kèm mã vận đơn
      listBody.querySelectorAll('.btn-status-ship').forEach(b => {
        b.addEventListener('click', async () => {
          const code = b.getAttribute('data-code');
          const tracking = prompt(`Nhập mã vận đơn (Viettel Post / GHTK) cho đơn ${code}:`, 'VNPOST-' + Math.floor(100000 + Math.random() * 900000));
          if (tracking !== null) {
            try {
              await api.patch(`/api/v1/admin/orders/${code}/status`, {
                status: 'shipping',
                tracking_number: tracking
              });
              api.showToast(`Đơn ${code} đã chuyển sang "Đang giao" với mã vận đơn: ${tracking}`, 'success');
              loadAdminOrders(statusFilter);
            } catch (err) {
              api.showToast(err.message, 'error');
            }
          }
        });
      });

    } catch (err) {
      listBody.innerHTML = `<tr><td colspan="6" style="color:var(--rust); text-align:center;">Lỗi nạp đơn: ${err.message}</td></tr>`;
    }
  }

  async function loadAdminInventory() {
    const tableBody = document.getElementById('adminInventoryTable');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Đang tải danh sách kho...</td></tr>';

    try {
      const res = await api.get('/api/v1/admin/products');
      if (!res.success || !res.data) return;

      let rows = '';
      res.data.forEach(p => {
        (p.variants || []).forEach(v => {
          rows += `
            <tr>
              <td><strong>${p.name}</strong></td>
              <td>${v.name}</td>
              <td><code>${v.sku}</code></td>
              <td>
                <input type="number" class="form-input inv-stock-input" value="${v.stock}" data-pid="${p.id}" data-vid="${v.id}" style="width:90px; padding:0.4rem;" min="0">
              </td>
              <td>
                <input type="number" class="form-input inv-price-input" value="${v.price}" data-pid="${p.id}" data-vid="${v.id}" style="width:130px; padding:0.4rem;" step="10000">
              </td>
            </tr>
          `;
        });
      });

      rows += `
        <tr>
          <td colspan="5" style="text-align:right; padding:1.2rem;">
            <button type="button" class="btn-primary" id="btnSaveInventory" style="padding:0.6rem 1.4rem;">Lưu Cập Nhật Kho Hàng</button>
          </td>
        </tr>
      `;

      tableBody.innerHTML = rows;

      document.getElementById('btnSaveInventory')?.addEventListener('click', async () => {
        const stockInputs = tableBody.querySelectorAll('.inv-stock-input');
        const priceInputs = tableBody.querySelectorAll('.inv-price-input');
        
        try {
          for (let i = 0; i < stockInputs.length; i++) {
            const pid = stockInputs[i].getAttribute('data-pid');
            const vid = stockInputs[i].getAttribute('data-vid');
            const stock = parseInt(stockInputs[i].value, 10);
            const price = parseInt(priceInputs[i].value, 10);

            await api.patch(`/api/v1/admin/products/${pid}/variants`, {
              variant_id: vid,
              stock,
              price
            });
          }
          api.showToast('Cập nhật tồn kho và giá thành công!', 'success');
          window.TovangProducts?.loadProducts();
        } catch (err) {
          api.showToast('Lỗi lưu kho: ' + err.message, 'error');
        }
      });

    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="5" style="color:var(--rust); text-align:center;">Lỗi nạp tồn kho: ${err.message}</td></tr>`;
    }
  }

  function setupAdminUI() {
    const modal = document.getElementById('adminModal');
    const closeBtn = document.getElementById('btnCloseAdminModal');

    closeBtn?.addEventListener('click', closeAdminModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeAdminModal();
    });

    modal?.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchAdminTab(tab);
        if (tab === 'dashboard') loadAdminDashboard();
        if (tab === 'orders') loadAdminOrders();
        if (tab === 'inventory') loadAdminInventory();
      });
    });

    // Lọc trạng thái đơn
    document.getElementById('adminOrderStatusSelect')?.addEventListener('change', (e) => {
      loadAdminOrders(e.target.value);
    });

    // Tìm kiếm đơn hàng theo từ khóa
    document.getElementById('adminOrderSearchInput')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const rows = document.querySelectorAll('#adminOrdersTable tr');
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(query) ? '' : 'none';
      });
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
    loadAdminInventory
  };
})();
