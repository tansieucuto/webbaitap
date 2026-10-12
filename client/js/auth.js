/**
 * TỔ VÀNG — AUTH.JS
 * Quản lý Đăng Nhập, Đăng Ký, Đăng Xuất, Khôi phục mật khẩu & Trạng thái Navbar
 */

(function () {
  'use strict';

  const api = window.TovangApi;

  function initAuthUI() {
    setupNavbarAuth();
    setupAuthModal();
  }

  // 1. CẬP NHẬT GIAO DIỆN NAVBAR THEO TRẠNG THÁI NGƯỜI DÙNG
  function setupNavbarAuth() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    // Tạo container cho nút tài khoản nếu chưa có
    let userContainer = document.getElementById('navUserContainer');
    if (!userContainer) {
      userContainer = document.createElement('div');
      userContainer.id = 'navUserContainer';
      userContainer.className = 'user-menu-wrapper';
      // Đặt trước nút Giỏ hàng
      const cartBtn = document.getElementById('btnNavCart');
      navActions.insertBefore(userContainer, cartBtn);
    }

    api.onAuthChange(user => {
      if (user) {
        // Đã đăng nhập: Hiển thị tên & Menu dropdown
        const shortName = user.full_name || user.email.split('@')[0];
        const isAdmin = user.role === 'admin' || user.role === 'staff';

        userContainer.innerHTML = `
          <button class="btn-nav-auth" id="btnUserMenu" title="Tài khoản của bạn">
            <span style="color:var(--gold);">👤</span>
            <span>${shortName}</span>
            <span style="font-size:0.6rem; opacity:0.6;">▼</span>
          </button>
          <div class="user-dropdown" id="userDropdown">
            <div class="user-dropdown-header">
              <div class="user-dropdown-name">${user.full_name}</div>
              <div class="user-dropdown-email">${user.email} · [${user.role.toUpperCase()}]</div>
            </div>
            <a class="user-dropdown-link" id="menuItemMyOrders" href="account.html#orders">
              <span>Đơn Hàng Của Tôi</span>
              <span style="color:var(--gold);">→</span>
            </a>
            <a class="user-dropdown-link" id="menuItemProfile" href="account.html#profile">
              <span>Thông Tin & Địa Chỉ</span>
              <span style="color:var(--gold);">→</span>
            </a>
            ${isAdmin ? `
            <a class="user-dropdown-link" id="menuItemAdmin" href="admin.html" style="color:var(--rust); font-weight:600;">
              <span>Quản Trị Hệ Thống</span>
              <span style="color:var(--rust);">★</span>
            </a>` : ''}
            <a class="user-dropdown-link" id="menuItemLogout" style="border-top:1px solid var(--mist); color:#888;">
              <span>Đăng Xuất</span>
              <span>[ ✕ ]</span>
            </a>
          </div>
        `;

        const menuBtn = document.getElementById('btnUserMenu');
        const dropdown = document.getElementById('userDropdown');

        if (menuBtn && dropdown) {
          menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
          });

          document.addEventListener('click', (e) => {
            if (!userContainer.contains(e.target)) {
              dropdown.classList.remove('active');
            }
          });
        }

        // Gắn sự kiện các mục menu
        document.getElementById('menuItemLogout')?.addEventListener('click', handleLogout);

      } else {
        // Chưa đăng nhập: Hiển thị nút Đăng Nhập
        userContainer.innerHTML = `
          <button class="btn-nav-auth" id="btnOpenAuthModal" title="Đăng nhập tài khoản">
            <span>[ ĐĂNG NHẬP ]</span>
          </button>
        `;

        document.getElementById('btnOpenAuthModal')?.addEventListener('click', () => {
          openAuthModal('login');
        });
      }
    });
  }

  // 2. MODAL ĐĂNG NHẬP / ĐĂNG KÝ
  function setupAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    const closeBtn = document.getElementById('btnCloseAuthModal');
    closeBtn?.addEventListener('click', closeAuthModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAuthModal();
    });

    // Chuyển Tabs (Đăng nhập / Đăng ký / Quên MK)
    modal.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchAuthTab(tab);
      });
    });

    // Form Đăng nhập
    const loginForm = document.getElementById('authLoginForm');
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmailInput').value.trim();
      const password = document.getElementById('loginPasswordInput').value;
      const msgEl = document.getElementById('authLoginMsg');

      try {
        msgEl.style.display = 'none';
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const origText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'ĐANG XỬ LÝ...';

        const res = await api.post('/api/v1/auth/login', { email, password });
        submitBtn.disabled = false;
        submitBtn.textContent = origText;

        if (res.success && res.data?.user) {
          api.setUser(res.data.user);
          api.showToast(`Chào mừng trở lại, ${res.data.user.full_name}!`, 'success');
          closeAuthModal();
          // Cập nhật lại giỏ hàng (vì có gộp giỏ vãng lai)
          window.TovangCart?.loadCart();
        }
      } catch (err) {
        msgEl.className = 'form-message error';
        msgEl.textContent = err.message;
        msgEl.style.display = 'block';
        loginForm.querySelector('button[type="submit"]').disabled = false;
        loginForm.querySelector('button[type="submit"]').textContent = 'ĐĂNG NHẬP';
      }
    });

    // Nút điền nhanh tài khoản Demo
    document.getElementById('btnQuickFillCustomer')?.addEventListener('click', () => {
      document.getElementById('loginEmailInput').value = 'khachhang@tovang.vn';
      document.getElementById('loginPasswordInput').value = 'KhachHang@123';
    });

    document.getElementById('btnQuickFillAdmin')?.addEventListener('click', () => {
      document.getElementById('loginEmailInput').value = 'admin@tovang.vn';
      document.getElementById('loginPasswordInput').value = 'Admin@123456';
    });

    // Form Đăng ký
    const regForm = document.getElementById('authRegisterForm');
    regForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('regNameInput').value.trim();
      const email = document.getElementById('regEmailInput').value.trim();
      const phone = document.getElementById('regPhoneInput').value.trim();
      const password = document.getElementById('regPasswordInput').value;
      const privacy = document.getElementById('regPrivacyInput').checked;
      const msgEl = document.getElementById('authRegMsg');

      try {
        msgEl.style.display = 'none';
        if (!privacy) {
          throw new Error('Vui lòng đồng ý với chính sách quyền riêng tư để đăng ký.');
        }

        const submitBtn = regForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'ĐANG TẠO TÀI KHOẢN...';

        const res = await api.post('/api/v1/auth/register', {
          full_name,
          email,
          phone,
          password,
          privacy_policy: true
        });

        submitBtn.disabled = false;
        submitBtn.textContent = 'TẠO TÀI KHOẢN';

        if (res.success) {
          api.showToast('Đăng ký tài khoản thành công!', 'success');
          if (res.data?.user) {
            api.setUser(res.data.user);
            closeAuthModal();
            window.TovangCart?.loadCart();
          } else {
            msgEl.className = 'form-message success';
            msgEl.textContent = res.message || 'Vui lòng kiểm tra email để xác thực tài khoản.';
            msgEl.style.display = 'block';
          }
        }
      } catch (err) {
        msgEl.className = 'form-message error';
        msgEl.textContent = err.message;
        msgEl.style.display = 'block';
        regForm.querySelector('button[type="submit"]').disabled = false;
        regForm.querySelector('button[type="submit"]').textContent = 'TẠO TÀI KHOẢN';
      }
    });

    // Form Quên mật khẩu
    const forgotForm = document.getElementById('authForgotForm');
    forgotForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmailInput').value.trim();
      const msgEl = document.getElementById('authForgotMsg');

      try {
        msgEl.style.display = 'none';
        const submitBtn = forgotForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'ĐANG XỬ LÝ...';

        const res = await api.post('/api/v1/auth/forgot-password', { email });
        submitBtn.disabled = false;
        submitBtn.textContent = 'GỬI LIÊN KẾT ĐẶT LẠI MẬT KHẨU';

        msgEl.className = 'form-message success';
        msgEl.style.display = 'block';

        msgEl.innerHTML = `
          <div style="line-height:1.5;">${res.message || 'Yêu cầu đã được ghi nhận. Vui lòng kiểm tra hộp thư email của bạn để nhận liên kết đặt lại mật khẩu.'}</div>
          <div style="margin-top:0.6rem; font-size:0.75rem; color:#666; background:#fff; padding:0.5rem; border-radius:4px; border:1px solid #d4edda;">
            🔒 <em>Bảo mật: Vì lý do an toàn, liên kết đặt lại mật khẩu chỉ được gửi trực tiếp đến hòm thư email của chủ tài khoản.</em>
          </div>
        `;
      } catch (err) {
        msgEl.className = 'form-message error';
        msgEl.textContent = err.message;
        msgEl.style.display = 'block';
        forgotForm.querySelector('button[type="submit"]').disabled = false;
        forgotForm.querySelector('button[type="submit"]').textContent = 'GỬI LIÊN KẾT ĐẶT LẠI MẬT KHẨU';
      }
    });

    // Form Tìm lại tài khoản qua số điện thoại
    const findAccountForm = document.getElementById('authFindAccountForm');
    findAccountForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('findAccountPhoneInput').value.trim();
      const resBox = document.getElementById('findAccountResult');

      try {
        resBox.style.display = 'none';
        const res = await api.post('/api/v1/auth/find-account', { phone });
        resBox.style.display = 'block';
        resBox.style.background = '#e8f5e9';
        resBox.style.border = '1px solid #c8e6c9';
        resBox.style.color = '#2e7d32';
        resBox.innerHTML = `
          <strong>✓ Tìm thấy tài khoản:</strong> ${res.data.full_name}<br/>
          <strong>Email đăng ký:</strong> <span style="font-family:var(--font-mono);">${res.data.masked_email}</span>
        `;
      } catch (err) {
        resBox.style.display = 'block';
        resBox.style.background = '#ffebee';
        resBox.style.border = '1px solid #ffcdd2';
        resBox.style.color = '#c62828';
        resBox.textContent = err.message || 'Không tìm thấy tài khoản với số điện thoại này.';
      }
    });

    // Form Đặt lại mật khẩu mới
    const resetForm = document.getElementById('authResetPasswordForm');
    resetForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('resetTokenInput').value.trim();
      const new_password = document.getElementById('resetNewPasswordInput').value;
      const confirm_password = document.getElementById('resetConfirmPasswordInput').value;
      const msgEl = document.getElementById('authForgotMsg');

      try {
        if (new_password !== confirm_password) {
          throw new Error('Mật khẩu xác nhận không khớp với mật khẩu mới.');
        }
        if (new_password.length < 10) {
          throw new Error('Mật khẩu mới phải có tối thiểu 10 ký tự.');
        }

        const submitBtn = resetForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'ĐANG CẬP NHẬT...';

        const res = await api.post('/api/v1/auth/reset-password', { token, new_password });
        submitBtn.disabled = false;
        submitBtn.textContent = 'LƯU MẬT KHẨU MỚI';

        api.showToast(res.message || 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.', 'success');
        resetForm.reset();
        showForgotSection();
        switchAuthTab('login');

        const loginMsg = document.getElementById('authLoginMsg');
        if (loginMsg) {
          loginMsg.className = 'form-message success';
          loginMsg.textContent = 'Mật khẩu đã đổi thành công. Vui lòng đăng nhập bằng mật khẩu mới.';
          loginMsg.style.display = 'block';
        }
      } catch (err) {
        msgEl.className = 'form-message error';
        msgEl.textContent = err.message;
        msgEl.style.display = 'block';
        resetForm.querySelector('button[type="submit"]').disabled = false;
        resetForm.querySelector('button[type="submit"]').textContent = 'LƯU MẬT KHẨU MỚI';
      }
    });

    document.getElementById('btnBackToForgot')?.addEventListener('click', showForgotSection);
    document.getElementById('btnOpenManualReset')?.addEventListener('click', () => openResetPasswordSection(''));
  }

  function showForgotSection() {
    const forgotSub = document.getElementById('forgotPasswordSubSection');
    const resetSub = document.getElementById('resetPasswordSubSection');
    const msgEl = document.getElementById('authForgotMsg');
    if (forgotSub) forgotSub.style.display = 'block';
    if (resetSub) resetSub.style.display = 'none';
    if (msgEl) msgEl.style.display = 'none';
  }

  function openResetPasswordSection(token = '') {
    const forgotSub = document.getElementById('forgotPasswordSubSection');
    const resetSub = document.getElementById('resetPasswordSubSection');
    const msgEl = document.getElementById('authForgotMsg');
    if (forgotSub) forgotSub.style.display = 'none';
    if (resetSub) resetSub.style.display = 'block';
    if (msgEl) msgEl.style.display = 'none';
    const tokenInput = document.getElementById('resetTokenInput');
    if (tokenInput && token) tokenInput.value = token;
  }

  function switchAuthTab(tabName) {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    modal.querySelectorAll('.modal-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
    });

    document.getElementById('authTabLogin').style.display = tabName === 'login' ? 'block' : 'none';
    document.getElementById('authTabRegister').style.display = tabName === 'register' ? 'block' : 'none';
    document.getElementById('authTabForgot').style.display = tabName === 'forgot' ? 'block' : 'none';

    if (tabName === 'forgot') {
      showForgotSection();
    }
  }

  function openAuthModal(defaultTab = 'login') {
    const modal = document.getElementById('authModal');
    if (modal) {
      switchAuthTab(defaultTab);
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  async function handleLogout() {
    try {
      await api.post('/api/v1/auth/logout');
      api.setUser(null);
      api.showToast('Bạn đã đăng xuất khỏi hệ thống.', 'info');
      window.TovangCart?.loadCart();
    } catch (err) {
      api.showToast(err.message, 'error');
    }
  }

  function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset_token');
    if (resetToken) {
      openAuthModal('forgot');
      openResetPasswordSection(resetToken);
    }
  }

  // Khởi tạo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAuthUI();
      checkUrlParams();
    });
  } else {
    initAuthUI();
    checkUrlParams();
  }

  window.TovangAuth = {
    openAuthModal,
    closeAuthModal,
    openResetPasswordSection,
    logout: handleLogout
  };
})();
