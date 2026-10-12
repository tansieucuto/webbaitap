/**
 * TỔ VÀNG — ACCOUNT.JS
 * Quản lý Lịch Sử Đơn Hàng (C7, C8), Thông Tin Tài Khoản, Sổ Địa Chỉ & Quyền Dữ Liệu Cá Nhân (D1-D3)
 */

(function () {
  'use strict';

  const api = window.TovangApi;

  const STATUS_LABELS = {
    pending_payment: 'Chờ thanh toán',
    pending_confirmation: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipping: 'Đang vận chuyển',
    delivered: 'Đã giao thành công',
    delivery_failed: 'Giao thất bại',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền'
  };

  async function openOrders() {
    const modal = document.getElementById('accountModal');
    if (!modal) return;

    switchAccountTab('orders');
    await loadUserOrders();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  async function openProfile() {
    const modal = document.getElementById('accountModal');
    if (!modal) return;

    switchAccountTab('profile');
    await loadUserProfileAndAddresses();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function switchAccountTab(tabName) {
    const modal = document.getElementById('accountModal');
    if (!modal) return;

    modal.querySelectorAll('.account-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.getElementById('accountTabOrders').style.display = tabName === 'orders' ? 'block' : 'none';
    document.getElementById('accountTabProfile').style.display = tabName === 'profile' ? 'block' : 'none';
    document.getElementById('accountTabPrivacy').style.display = tabName === 'privacy' ? 'block' : 'none';
  }

  async function loadUserOrders() {
    const container = document.getElementById('userOrdersList');
    if (!container) return;

    container.innerHTML = '<div style="font-family:var(--font-mono); font-size:0.8rem; color:#888; text-align:center; padding:2rem;">Đang nạp đơn hàng...</div>';

    try {
      const res = await api.get('/api/v1/orders');
      if (!res.success || !res.data || res.data.length === 0) {
        container.innerHTML = `
          <div class="cart-empty" style="padding:2.5rem 0;">
            <span class="cart-empty-tag">[ LỊCH SỬ TRỐNG ]</span>
            <h4>Bạn Chưa Có Đơn Hàng Nào</h4>
            <p style="font-size:0.75rem; color:#888; margin-top:0.5rem;">
              Khi bạn đặt các sản phẩm mật ong rừng Tổ Vàng, chi tiết đơn hàng sẽ xuất hiện tại đây.
            </p>
          </div>
        `;
        return;
      }

      let html = '';
      res.data.forEach(order => {
        const statusLabel = STATUS_LABELS[order.status] || order.status;
        const dateStr = new Date(order.created_at).toLocaleDateString('vi-VN', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        const canCancel = ['pending_payment', 'pending_confirmation', 'confirmed'].includes(order.status);
        const hasVietQR = order.payment_method === 'bank_transfer' && order.status === 'pending_payment';
        const isDelivered = order.status === 'delivered';

        let itemsHtml = '';
        (order.items || []).forEach(it => {
          itemsHtml += `
            <div class="order-item-mini">
              <span>${it.product_name} (${it.variant_name}) × ${it.quantity}</span>
              <span>${api.formatMoney(it.subtotal)}</span>
            </div>
          `;
        });

        html += `
          <div class="order-card" data-code="${order.order_code}">
            <div class="order-card-header">
              <div>
                <span class="order-code-title">${order.order_code}</span>
                <span class="order-date-text"> · ${dateStr}</span>
              </div>
              <span class="status-badge ${order.status}">${statusLabel}</span>
            </div>

            <div style="margin: 0.8rem 0; border-bottom: 1px dashed var(--mist); padding-bottom: 0.6rem;">
              ${itemsHtml}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:0.75rem; margin-top:0.6rem;">
              <span style="color:#777;">Người nhận: ${order.recipient_name} (${order.phone})</span>
              <span style="font-weight:700; color:var(--rust);">Tổng: ${api.formatMoney(order.total)}</span>
            </div>

            <div style="font-family:var(--font-mono); font-size:0.68rem; color:#888; margin-top:0.3rem;">
              Địa chỉ: ${order.full_address}
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.6rem; margin-top:1.2rem; border-top:1px solid var(--mist); padding-top:0.8rem;">
              ${hasVietQR ? `
                <button type="button" class="btn-small btn-view-vietqr" data-code="${order.order_code}">
                  Xem QR Chuyển Khoản
                </button>` : ''}

              ${isDelivered ? `
                <button type="button" class="btn-small" onclick="window.TovangReviews?.openModal();">
                  Đánh Giá Sản Phẩm
                </button>` : ''}

              ${canCancel ? `
                <button type="button" class="btn-small btn-small-danger btn-cancel-order" data-code="${order.order_code}">
                  Hủy Đơn Hàng
                </button>` : ''}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      // Sự kiện nút hủy đơn
      container.querySelectorAll('.btn-cancel-order').forEach(btn => {
        btn.addEventListener('click', async () => {
          const code = btn.getAttribute('data-code');
          if (confirm(`Bạn có chắc chắn muốn hủy đơn hàng ${code} không? Tồn kho sản phẩm sẽ được tự động hoàn lại.`)) {
            try {
              btn.disabled = true;
              btn.textContent = 'ĐANG HỦY...';
              const cancelRes = await api.post(`/api/v1/orders/${code}/cancel`, {
                reason: 'Khách hàng chủ động hủy qua trang cá nhân'
              });
              api.showToast(cancelRes.message || 'Đã hủy đơn hàng thành công.', 'success');
              await loadUserOrders();
            } catch (err) {
              btn.disabled = false;
              btn.textContent = 'Hủy Đơn Hàng';
              api.showToast(err.message, 'error');
            }
          }
        });
      });

      // Sự kiện nút xem VietQR
      container.querySelectorAll('.btn-view-vietqr').forEach(btn => {
        btn.addEventListener('click', async () => {
          const code = btn.getAttribute('data-code');
          try {
            const orderRes = await api.get(`/api/v1/orders/${code}`);
            if (orderRes.success && orderRes.data) {
              window.TovangCheckout?.openOrderConfirmation({
                orderCode: orderRes.data.order_code,
                total: orderRes.data.total,
                paymentMethod: 'bank_transfer',
                bankDetails: orderRes.data.bankDetails
              });
            }
          } catch (err) {
            api.showToast(err.message, 'error');
          }
        });
      });

    } catch (err) {
      container.innerHTML = `<div style="color:var(--rust); font-family:var(--font-mono); padding:1.5rem; text-align:center;">Lỗi nạp đơn hàng: ${err.message}</div>`;
    }
  }

  async function loadUserProfileAndAddresses() {
    try {
      const [profileRes, addrRes] = await Promise.all([
        api.get('/api/v1/users/profile'),
        api.get('/api/v1/users/addresses')
      ]);

      if (profileRes.success && profileRes.data) {
        document.getElementById('profileFullName').value = profileRes.data.full_name || '';
        document.getElementById('profileEmail').value = profileRes.data.email || '';
        document.getElementById('profilePhone').value = profileRes.data.phone || '';
      }

      renderAddressBook(addrRes.success ? addrRes.data : []);
    } catch (err) {
      api.showToast('Không thể nạp hồ sơ: ' + err.message, 'error');
    }
  }

  function renderAddressBook(addresses) {
    const listEl = document.getElementById('addressBookList');
    if (!listEl) return;

    if (addresses.length === 0) {
      listEl.innerHTML = '<div style="font-family:var(--font-mono); font-size:0.75rem; color:#888;">Chưa có địa chỉ nào được lưu.</div>';
      return;
    }

    let html = '';
    addresses.forEach(addr => {
      html += `
        <div style="border:1px solid var(--mist); background:var(--cream); padding:0.9rem; margin-bottom:0.8rem; font-family:var(--font-mono); font-size:0.72rem; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${addr.recipient_name}</strong> (${addr.phone}) ${addr.is_default ? '<span style="color:var(--gold); font-weight:bold;">[MẶC ĐỊNH]</span>' : ''}
            <div style="color:#666; margin-top:0.2rem;">${addr.street_address}, ${addr.ward ? addr.ward + ', ' : ''}${addr.district ? addr.district + ', ' : ''}${addr.province}</div>
          </div>
          <button type="button" class="btn-small btn-small-danger btn-del-addr" data-id="${addr.id}" style="padding:0.2rem 0.5rem;">✕</button>
        </div>
      `;
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('.btn-del-addr').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        if (confirm('Xóa địa chỉ này?')) {
          await api.delete(`/api/v1/users/addresses/${id}`);
          api.showToast('Đã xóa địa chỉ.', 'info');
          const refresh = await api.get('/api/v1/users/addresses');
          renderAddressBook(refresh.success ? refresh.data : []);
        }
      });
    });
  }

  function setupAccountUI() {
    const modal = document.getElementById('accountModal');
    const closeBtn = document.getElementById('btnCloseAccountModal');

    closeBtn?.addEventListener('click', closeAccountModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeAccountModal();
    });

    // Tab buttons
    modal?.querySelectorAll('.account-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchAccountTab(tab);
        if (tab === 'orders') loadUserOrders();
        if (tab === 'profile') loadUserProfileAndAddresses();
      });
    });

    // Profile form submit
    const profileForm = document.getElementById('userProfileForm');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('profileFullName').value.trim();
      const phone = document.getElementById('profilePhone').value.trim();

      try {
        await api.patch('/api/v1/users/profile', { full_name, phone });
        api.showToast('Cập nhật thông tin thành công!', 'success');
        api.checkAuth();
      } catch (err) {
        api.showToast(err.message, 'error');
      }
    });

    // Add Address Form
    const addAddrForm = document.getElementById('newAddressForm');
    addAddrForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const recipient_name = document.getElementById('newAddrName').value.trim();
      const phone = document.getElementById('newAddrPhone').value.trim();
      const street_address = document.getElementById('newAddrStreet').value.trim();
      const province = document.getElementById('newAddrProvince').value.trim();
      const is_default = document.getElementById('newAddrDefault').checked;

      try {
        await api.post('/api/v1/users/addresses', {
          recipient_name, phone, street_address, province, is_default
        });
        api.showToast('Đã thêm địa chỉ mới thành công!', 'success');
        addAddrForm.reset();
        const refresh = await api.get('/api/v1/users/addresses');
        renderAddressBook(refresh.success ? refresh.data : []);
      } catch (err) {
        api.showToast(err.message, 'error');
      }
    });

    // Xuất dữ liệu cá nhân (D2)
    document.getElementById('btnExportUserData')?.addEventListener('click', async () => {
      try {
        const res = await api.get('/api/v1/users/profile');
        const orders = await api.get('/api/v1/orders');
        const addresses = await api.get('/api/v1/users/addresses');

        const exportData = {
          user_profile: res.data,
          orders: orders.data,
          addresses: addresses.data,
          exported_at: new Date().toISOString(),
          policy: 'Tổ Vàng Privacy Standard — Tuân thủ Nghị định 13/2023/NĐ-CP'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tovang_my_data_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        api.showToast('Dữ liệu cá nhân đã được tải về thành công!', 'success');
      } catch (err) {
        api.showToast('Không thể xuất dữ liệu: ' + err.message, 'error');
      }
    });
  }

  function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAccountUI);
  } else {
    setupAccountUI();
  }

  window.TovangAccount = {
    openOrders,
    openProfile,
    closeAccountModal,
    loadUserOrders,
    loadUserProfileAndAddresses
  };
})();
