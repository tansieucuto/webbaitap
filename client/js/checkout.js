/**
 * TỔ VÀNG — CHECKOUT.JS
 * Quản lý Luồng Thanh Toán (C2), Tạo Đơn Hàng (C3, C4), VietQR (C5) & Xác Nhận Đơn
 */

(function () {
  'use strict';

  const api = window.TovangApi;
  let currentCart = null;

  async function openCheckout(cart) {
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    currentCart = cart;

    // Lấy thông tin user hiện tại
    const user = api.getUser();
    if (!user) {
      api.showToast('Vui lòng đăng nhập trước khi thanh toán.', 'error');
      return;
    }

    // Điền trước thông tin người nhận
    const nameInput = document.getElementById('checkoutRecipientName');
    const phoneInput = document.getElementById('checkoutPhone');
    const addressInput = document.getElementById('checkoutAddress');

    if (nameInput) nameInput.value = user.full_name || '';
    if (phoneInput) phoneInput.value = user.phone || '';

    // Nạp sổ địa chỉ người dùng
    try {
      const res = await api.get('/api/v1/users/addresses');
      if (res.success && res.data && res.data.length > 0) {
        const defaultAddr = res.data.find(a => a.is_default) || res.data[0];
        if (addressInput && !addressInput.value) {
          addressInput.value = `${defaultAddr.street_address}, ${defaultAddr.ward ? defaultAddr.ward + ', ' : ''}${defaultAddr.district ? defaultAddr.district + ', ' : ''}${defaultAddr.province}`;
        }
        if (nameInput && !nameInput.value) nameInput.value = defaultAddr.recipient_name;
        if (phoneInput && !phoneInput.value) phoneInput.value = defaultAddr.phone;
      }
    } catch (_) {}

    // Render tóm tắt đơn hàng
    renderCheckoutSummary();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function renderCheckoutSummary() {
    const itemsContainer = document.getElementById('checkoutItemsList');
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const shippingEl = document.getElementById('checkoutShippingFee');
    const totalEl = document.getElementById('checkoutTotal');

    if (!itemsContainer || !currentCart) return;

    let itemsHtml = '';
    currentCart.items.forEach(item => {
      itemsHtml += `
        <div class="checkout-row">
          <span>${item.product_name} (${item.variant_name}) x${item.quantity}</span>
          <span>${api.formatMoney(item.price * item.quantity)}</span>
        </div>
      `;
    });
    itemsContainer.innerHTML = itemsHtml;

    if (subtotalEl) subtotalEl.textContent = api.formatMoney(currentCart.subtotal);
    if (shippingEl) {
      shippingEl.textContent = currentCart.shipping_fee === 0
        ? 'Miễn phí'
        : api.formatMoney(currentCart.shipping_fee);
    }
    if (totalEl) totalEl.textContent = api.formatMoney(currentCart.total);
  }

  function setupCheckoutUI() {
    const modal = document.getElementById('checkoutModal');
    const closeBtn = document.getElementById('btnCloseCheckoutModal');
    const form = document.getElementById('checkoutForm');

    closeBtn?.addEventListener('click', closeCheckout);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeCheckout();
    });

    // Chọn phương thức thanh toán
    document.querySelectorAll('.payment-method-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    // Submit form đặt hàng
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgEl = document.getElementById('checkoutMsg');
      msgEl.style.display = 'none';

      const recipient_name = document.getElementById('checkoutRecipientName').value.trim();
      const phone = document.getElementById('checkoutPhone').value.trim();
      const full_address = document.getElementById('checkoutAddress').value.trim();
      const note = document.getElementById('checkoutNote').value.trim();
      const payment_method = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';

      if (!recipient_name || !phone || !full_address) {
        msgEl.className = 'form-message error';
        msgEl.textContent = 'Vui lòng điền đầy đủ tên người nhận, số điện thoại và địa chỉ giao hàng.';
        msgEl.style.display = 'block';
        return;
      }

      const submitBtn = document.getElementById('btnSubmitOrder');
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'ĐANG TẠO ĐƠN HÀNG...';

        const res = await api.post('/api/v1/orders', {
          recipient_name,
          phone,
          full_address,
          note,
          payment_method
        });

        submitBtn.disabled = false;
        submitBtn.textContent = 'XÁC NHẬN ĐẶT HÀNG';

        if (res.success && res.data) {
          closeCheckout();
          // Cập nhật lại giỏ hàng (giờ đã được làm trống trên server)
          window.TovangCart?.loadCart();
          // Mở modal xác nhận đơn hàng
          openOrderConfirmation(res.data);
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'XÁC NHẬN ĐẶT HÀNG';
        msgEl.className = 'form-message error';
        msgEl.textContent = err.message;
        msgEl.style.display = 'block';
      }
    });
  }

  function closeCheckout() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // 3. MODAL XÁC NHẬN ĐƠN HÀNG & MÃ VIETQR
  function openOrderConfirmation(orderData) {
    const modal = document.getElementById('orderConfirmationModal');
    if (!modal) return;

    document.getElementById('confirmOrderCode').textContent = orderData.orderCode;
    document.getElementById('confirmOrderTotal').textContent = api.formatMoney(orderData.total);

    const vietqrBlock = document.getElementById('confirmVietQRBlock');
    const codBlock = document.getElementById('confirmCodBlock');

    if (orderData.paymentMethod === 'bank_transfer' && orderData.bankDetails) {
      vietqrBlock.style.display = 'block';
      codBlock.style.display = 'none';

      document.getElementById('qrImage').src = orderData.bankDetails.qrUrl;
      document.getElementById('qrBankName').textContent = orderData.bankDetails.bankName;
      document.getElementById('qrAccountNo').textContent = orderData.bankDetails.accountNumber;
      document.getElementById('qrAccountName').textContent = orderData.bankDetails.accountName;
      document.getElementById('qrAmount').textContent = api.formatMoney(orderData.bankDetails.amount);
      document.getElementById('qrMemo').textContent = orderData.bankDetails.memo;

      // Copy buttons
      document.getElementById('btnCopyAccountNo').onclick = () => {
        navigator.clipboard.writeText(orderData.bankDetails.accountNumber);
        api.showToast('Đã sao chép số tài khoản!', 'success');
      };
      document.getElementById('btnCopyMemo').onclick = () => {
        navigator.clipboard.writeText(orderData.bankDetails.memo);
        api.showToast('Đã sao chép nội dung chuyển khoản!', 'success');
      };
    } else {
      vietqrBlock.style.display = 'none';
      codBlock.style.display = 'block';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function setupConfirmationEvents() {
    const modal = document.getElementById('orderConfirmationModal');
    const closeBtn = document.getElementById('btnCloseConfirmModal');
    const btnContinue = document.getElementById('btnConfirmContinueShopping');
    const btnMyOrders = document.getElementById('btnConfirmViewOrders');

    const closeFn = () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeFn);
    btnContinue?.addEventListener('click', closeFn);
    btnMyOrders?.addEventListener('click', () => {
      closeFn();
      window.TovangAccount?.openOrders();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupCheckoutUI();
      setupConfirmationEvents();
    });
  } else {
    setupCheckoutUI();
    setupConfirmationEvents();
  }

  window.TovangCheckout = {
    openCheckout,
    closeCheckout,
    openOrderConfirmation
  };
})();
