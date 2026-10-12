/**
 * TỔ VÀNG — API.JS
 * Lớp giao tiếp trung tâm với Backend Server API v1 & Quản lý Thông báo Toast
 */

(function () {
  'use strict';

  const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ? ''
    : 'http://localhost:3030';

  let currentUser = null;
  const authListeners = [];

  // 1. TOAST NOTIFICATION SYSTEM
  function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '✦';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `<span style="color:var(--gold); font-weight:bold;">[${icon}]</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Kích hoạt transition
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  // 2. HTTP REQUEST HELPER
  async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    const headers = {
      'Accept': 'application/json',
      ...options.headers
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const config = {
      ...options,
      headers,
      credentials: 'include' // Gửi kèm session cookie
    };

    try {
      const response = await fetch(url, config);
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { success: false, message: text || 'Phản hồi không hợp lệ từ máy chủ.' };
      }

      if (!response.ok) {
        const errorMsg = data?.error?.message || data?.message || `Lỗi yêu cầu (Mã ${response.status})`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.warn(`[API] ${options.method || 'GET'} ${endpoint} error:`, err.message);
      throw err;
    }
  }

  // 3. AUTH STATE MANAGEMENT
  async function checkAuth() {
    try {
      const res = await request('/api/v1/auth/me');
      if (res.success && res.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch (_) {
      setUser(null);
    }
    return currentUser;
  }

  function setUser(user) {
    currentUser = user;
    authListeners.forEach(fn => {
      try { fn(currentUser); } catch (e) { console.error(e); }
    });
  }

  function onAuthChange(fn) {
    authListeners.push(fn);
    fn(currentUser);
  }

  function getUser() {
    return currentUser;
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  function isAdmin() {
    return currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff');
  }

  function formatMoney(amount) {
    if (isNaN(amount)) return '0đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(amount)
      .replace('₫', 'đ');
  }

  // Xuất toàn cục
  window.TovangApi = {
    API_BASE,
    request,
    get: (url) => request(url, { method: 'GET' }),
    post: (url, body) => request(url, { method: 'POST', body }),
    patch: (url, body) => request(url, { method: 'PATCH', body }),
    delete: (url) => request(url, { method: 'DELETE' }),
    showToast,
    checkAuth,
    setUser,
    getUser,
    isLoggedIn,
    isAdmin,
    onAuthChange,
    formatMoney
  };

  // Tự động kiểm tra phiên khi trang tải
  document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
  });
})();
