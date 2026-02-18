/* ========================================
   CloudRetail - Frontend Application
   Connects to API Gateway on port 8080
   ======================================== */

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8080'
  : `http://${window.location.hostname}:8080`;

// ==================== STATE ====================
let state = {
  token: localStorage.getItem('cr_token') || null,
  user: JSON.parse(localStorage.getItem('cr_user') || 'null'),
  cart: JSON.parse(localStorage.getItem('cr_cart') || '[]'),
  products: [],
  orders: [],
  currentPage: 'home',
};

const CATEGORY_ICONS = {
  electronics: '&#x1F3AE;',
  books: '&#x1F4DA;',
  clothing: '&#x1F455;',
  home: '&#x1F3E0;',
  sports: '&#x26BD;',
  default: '&#x1F4E6;',
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  updateCartCount();

  // Require login before showing content
  if (!state.token || !state.user) {
    showModal('login');
  } else {
    loadProducts();
  }

  checkServiceHealth();
  startEventLog();
  setInterval(checkServiceHealth, 30000);
});

// ==================== NAVIGATION ====================
function navigate(page) {
  // Require login for all pages except viewing the login/register modals
  if (!state.token && page !== 'home') {
    showToast('Please log in first', 'error');
    showModal('login');
    return;
  }

  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (btn) btn.classList.add('active');

  if (page === 'orders') loadOrders();
  if (page === 'inventory') loadInventory();
  if (page === 'admin') refreshAdminPanel();
  if (page === 'cart') renderCart();
}

// ==================== API HELPERS ====================
async function apiFetch(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  }
  try {
    const res = await fetch(API_BASE + endpoint, { ...options, headers });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

// ==================== AUTH ====================
function showModal(name) {
  document.getElementById('modal-' + name).classList.remove('hidden');
}

function closeModal(name) {
  document.getElementById('modal-' + name).classList.add('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');

  const res = await apiFetch('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (res.ok && res.data && res.data.data) {
    state.token = res.data.data.token;
    state.user = res.data.data.user;
    localStorage.setItem('cr_token', state.token);
    localStorage.setItem('cr_user', JSON.stringify(state.user));
    updateAuthUI();
    closeModal('login');
    showToast('Welcome back, ' + state.user.firstName + '!', 'success');
    addEventLogEntry('USER_LOGIN', state.user.email + ' authenticated via JWT');
    loadProducts();
  } else if (res.ok && res.data && res.data.token) {
    state.token = res.data.token;
    state.user = res.data.user;
    localStorage.setItem('cr_token', state.token);
    localStorage.setItem('cr_user', JSON.stringify(state.user));
    updateAuthUI();
    closeModal('login');
    showToast('Welcome back, ' + state.user.firstName + '!', 'success');
    addEventLogEntry('USER_LOGIN', state.user.email + ' authenticated via JWT');
    loadProducts();
  } else {
    const errMsg = (res.data && res.data.error && res.data.error.message) || 'Login failed';
    errorEl.textContent = errMsg;
    errorEl.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const firstName = document.getElementById('reg-firstname').value;
  const lastName = document.getElementById('reg-lastname').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const gdprConsent = document.getElementById('reg-gdpr').checked;
  const errorEl = document.getElementById('register-error');
  errorEl.classList.add('hidden');

  const res = await apiFetch('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, email, password, gdprConsent }),
  });

  if (res.ok && res.data) {
    const d = res.data.data || res.data;
    if (d.token) {
      state.token = d.token;
      state.user = d.user;
      localStorage.setItem('cr_token', state.token);
      localStorage.setItem('cr_user', JSON.stringify(state.user));
      updateAuthUI();
      closeModal('register');
      showToast('Account created! Welcome, ' + (state.user.firstName || email) + '!', 'success');
      addEventLogEntry('USER_REGISTERED', email + ' - GDPR consent recorded, JWT issued');
      loadProducts();
    } else {
      closeModal('register');
      showToast('Account created! You can now log in.', 'success');
      addEventLogEntry('USER_REGISTERED', email + ' - GDPR consent recorded');
      showModal('login');
    }
  } else {
    const errMsg = (res.data && res.data.error && res.data.error.message) || 'Registration failed';
    errorEl.textContent = errMsg;
    errorEl.classList.remove('hidden');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('cr_token');
  localStorage.removeItem('cr_user');
  updateAuthUI();
  showToast('Logged out successfully', 'info');
  addEventLogEntry('USER_LOGOUT', 'Session terminated');
  navigate('home');
  showModal('login');
}

function updateAuthUI() {
  const userInfo = document.getElementById('user-info');
  const authButtons = document.getElementById('auth-buttons');
  const userName = document.getElementById('user-name');
  const ordersPrompt = document.getElementById('orders-login-prompt');

  if (state.user && state.token) {
    userInfo.classList.remove('hidden');
    authButtons.classList.add('hidden');
    userName.textContent = state.user.firstName || state.user.email;
    if (ordersPrompt) ordersPrompt.classList.add('hidden');
  } else {
    userInfo.classList.add('hidden');
    authButtons.classList.remove('hidden');
    if (ordersPrompt) ordersPrompt.classList.remove('hidden');
  }
}

// ==================== PRODUCTS ====================
async function loadProducts() {
  const grid = document.getElementById('products-grid');
  const loading = document.getElementById('products-loading');
  grid.innerHTML = '';
  loading.classList.add('active');

  const res = await apiFetch('/api/products');

  let products;
  if (res.ok && res.data && res.data.data) {
    const d = res.data.data;
    products = Array.isArray(d) ? d : d.products || [];
    addEventLogEntry('PRODUCTS_LOADED', products.length + ' items from Product Service');
  } else {
    products = [];
    addEventLogEntry('PRODUCTS_LOADED', 'No products available');
  }

  state.products = products;
  loading.classList.remove('active');
  renderProducts(products);
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">?</div><p>No products found. Add products via the API.</p></div>';
    return;
  }

  products.forEach(p => {
    const icon = CATEGORY_ICONS[p.category] || CATEGORY_ICONS.default;
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-image">${icon}</div>
      <div class="product-info">
        <div class="product-category">${escapeHtml(p.category || 'general')}</div>
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-desc">${escapeHtml(p.description || '')}</div>
        <div class="product-footer">
          <span class="product-price">$${Number(p.price).toFixed(2)}</span>
          <span class="product-sku">${escapeHtml(p.sku || '')}</span>
        </div>
      </div>
      <div class="product-actions">
        <button class="pixel-btn pixel-btn-primary pixel-btn-sm" onclick="addToCart('${p.id}')">ADD TO CART</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function searchProducts() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const category = document.getElementById('category-filter').value;
  let filtered = state.products.filter(p => {
    const matchSearch = !query || p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query);
    const matchCategory = !category || p.category === category;
    return matchSearch && matchCategory;
  });
  renderProducts(filtered);
}

function filterProducts() {
  searchProducts();
}

// ==================== CART ====================
function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(c => c.productId === productId);
  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      quantity: 1,
    });
  }

  saveCart();
  updateCartCount();
  showToast('Added ' + product.name + ' to cart', 'success');
  addEventLogEntry('CART_UPDATED', product.name + ' added (qty: ' + (existing ? existing.quantity : 1) + ')');
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(c => c.productId !== productId);
  saveCart();
  updateCartCount();
  renderCart();
}

function updateQty(productId, delta) {
  const item = state.cart.find(c => c.productId === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  saveCart();
  updateCartCount();
  renderCart();
}

function saveCart() {
  localStorage.setItem('cr_cart', JSON.stringify(state.cart));
}

function updateCartCount() {
  const count = state.cart.reduce((sum, c) => sum + c.quantity, 0);
  document.getElementById('cart-count').textContent = count;
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const emptyEl = document.getElementById('cart-empty');
  const summaryEl = document.getElementById('cart-summary');

  container.innerHTML = '';

  if (state.cart.length === 0) {
    emptyEl.classList.remove('hidden');
    summaryEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  summaryEl.classList.remove('hidden');

  let subtotal = 0;

  state.cart.forEach(item => {
    const icon = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.default;
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <div class="cart-item-icon">${icon}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">$${Number(item.price).toFixed(2)} each = $${itemTotal.toFixed(2)}</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="updateQty('${item.productId}', -1)">-</button>
        <span class="qty-value">${item.quantity}</span>
        <button class="qty-btn" onclick="updateQty('${item.productId}', 1)">+</button>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.productId}')">X</button>
    `;
    container.appendChild(el);
  });

  document.getElementById('cart-subtotal').textContent = '$' + subtotal.toFixed(2);
  document.getElementById('cart-total').textContent = '$' + (subtotal + 5.99).toFixed(2);
}

// ==================== ORDERS ====================
async function placeOrder() {
  if (!state.token) {
    showToast('Please log in to place an order', 'error');
    showModal('login');
    return;
  }

  const address = document.getElementById('shipping-address').value;
  if (!address) {
    showToast('Please enter a shipping address', 'error');
    return;
  }

  const items = state.cart.map(c => ({
    productId: c.productId,
    productName: c.name || 'Product',
    quantity: c.quantity,
    price: c.price,
  }));

  const totalAmount = state.cart.reduce((sum, c) => sum + c.price * c.quantity, 0) + 5.99;

  // Parse address into required format
  const shippingAddress = {
    street: address,
    city: 'Singapore',
    state: 'SG',
    zipCode: '000000',
    country: 'Singapore'
  };

  addEventLogEntry('ORDER_INITIATED', 'Creating order via Saga pattern...');

  const res = await apiFetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ items, shippingAddress }),
  });

  if (res.ok && res.data) {
    addEventLogEntry('ORDER_CREATED', 'Order ID: ' + (res.data.data?.id || 'confirmed'));
    addEventLogEntry('INVENTORY_RESERVED', 'Stock reserved via Inventory Service');
    addEventLogEntry('PAYMENT_PROCESSED', 'Payment completed via Payment Service');
    addEventLogEntry('EVENT_PUBLISHED', 'order-created event sent to Kafka');

    state.cart = [];
    saveCart();
    updateCartCount();
    showModal('order-success');
  } else {
    const errMsg = (res.data && res.data.error && res.data.error.message) || 'Order failed. Please try again.';
    showToast(errMsg, 'error');
    addEventLogEntry('ORDER_FAILED', errMsg);
  }
}

async function loadOrders() {
  if (!state.token) return;

  const ordersContainer = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');
  const loginPrompt = document.getElementById('orders-login-prompt');

  loginPrompt.classList.add('hidden');
  ordersContainer.innerHTML = '';

  const res = await apiFetch('/api/orders');

  let orders = [];
  if (res.ok && res.data && res.data.data) {
    orders = Array.isArray(res.data.data) ? res.data.data : [];
    addEventLogEntry('ORDERS_LOADED', orders.length + ' orders from Order Service');
  }

  if (orders.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  orders.reverse().forEach(order => {
    const card = document.createElement('div');
    card.className = 'order-card';
    const status = order.status || 'pending';
    const date = order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A';
    const itemsHtml = (order.items || []).map(item =>
      `<div class="order-item-row"><span>${escapeHtml(item.name || item.productId)} x${item.quantity}</span><span>$${(item.price * item.quantity).toFixed(2)}</span></div>`
    ).join('');

    card.innerHTML = `
      <div class="order-header">
        <span class="order-id">ORDER: ${escapeHtml(order.id)}</span>
        <span class="order-status ${status}">${status.toUpperCase()}</span>
      </div>
      <div class="order-items">${itemsHtml}</div>
      <div class="order-total">TOTAL: $${Number(order.totalAmount).toFixed(2)}</div>
      <div class="order-date">${date}</div>
    `;
    ordersContainer.appendChild(card);
  });
}

// ==================== INVENTORY ====================
async function loadInventory() {
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = '';

  // Load inventory for each known product from the API
  let inventory = [];
  for (const product of state.products) {
    const res = await apiFetch('/api/inventory/product/' + product.id);
    if (res.ok && res.data && res.data.data) {
      inventory.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || '',
        quantity: res.data.data.quantity || 0,
        reservedQuantity: res.data.data.reservedQuantity || 0,
      });
    }
  }

  if (inventory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1rem">No inventory data available</td></tr>';
    addEventLogEntry('INVENTORY_LOADED', 'No inventory data');
    return;
  }

  inventory.forEach(item => {
    const available = item.quantity - item.reservedQuantity;
    let statusClass, statusText;
    if (available <= 0) {
      statusClass = 'out-of-stock';
      statusText = 'OUT OF STOCK';
    } else if (available < 20) {
      statusClass = 'low-stock';
      statusText = 'LOW STOCK';
    } else {
      statusClass = 'in-stock';
      statusText = 'IN STOCK';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.productName)}</td>
      <td style="font-family:var(--font-pixel);font-size:0.35rem;color:var(--text-muted)">${escapeHtml(item.sku)}</td>
      <td>${item.quantity}</td>
      <td>${item.reservedQuantity}</td>
      <td><strong>${available}</strong></td>
      <td><span class="stock-badge ${statusClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });

  addEventLogEntry('INVENTORY_LOADED', inventory.length + ' items from Inventory Service');
}

// ==================== ADMIN ====================

// Populate product dropdowns in admin panel
function populateAdminDropdowns() {
  const invSelect = document.getElementById('admin-inv-product');
  const deleteSelect = document.getElementById('admin-delete-product');

  if (!invSelect || !deleteSelect) return;

  // Clear existing options except first
  invSelect.innerHTML = '<option value="">Select Product</option>';
  deleteSelect.innerHTML = '<option value="">Select Product to Delete</option>';

  state.products.forEach(p => {
    const opt1 = document.createElement('option');
    opt1.value = p.id;
    opt1.textContent = p.name + ' (' + p.sku + ')';
    invSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = p.id;
    opt2.textContent = p.name + ' (' + p.sku + ')';
    deleteSelect.appendChild(opt2);
  });
}

// Show admin message
function showAdminMessage(message, isError = false) {
  const msgEl = document.getElementById('admin-message');
  if (!msgEl) return;
  msgEl.textContent = message;
  msgEl.className = 'admin-message ' + (isError ? 'error' : 'success');
  msgEl.classList.remove('hidden');
  setTimeout(() => msgEl.classList.add('hidden'), 5000);
}

// Add Product
async function handleAddProduct(e) {
  e.preventDefault();

  if (!state.user || state.user.role === 'customer') {
    showAdminMessage('Only admin or vendor can add products', true);
    return;
  }

  const name = document.getElementById('admin-product-name').value;
  const description = document.getElementById('admin-product-desc').value;
  const price = parseFloat(document.getElementById('admin-product-price').value);
  const category = document.getElementById('admin-product-category').value;
  const sku = document.getElementById('admin-product-sku').value;

  const res = await apiFetch('/api/products', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      price,
      category,
      sku,
      vendorId: state.user.id,
    }),
  });

  if (res.ok && res.data) {
    showAdminMessage('Product "' + name + '" added successfully!');
    addEventLogEntry('PRODUCT_CREATED', name + ' added to catalog');
    // Clear form
    document.getElementById('admin-product-name').value = '';
    document.getElementById('admin-product-desc').value = '';
    document.getElementById('admin-product-price').value = '';
    document.getElementById('admin-product-category').value = '';
    document.getElementById('admin-product-sku').value = '';
    // Reload products
    await loadProducts();
    populateAdminDropdowns();
  } else {
    const errMsg = (res.data && res.data.error && res.data.error.message) || 'Failed to add product';
    showAdminMessage(errMsg, true);
  }
}

// Add Inventory
async function handleAddInventory(e) {
  e.preventDefault();

  if (!state.user || state.user.role === 'customer') {
    showAdminMessage('Only admin or vendor can manage inventory', true);
    return;
  }

  const productId = document.getElementById('admin-inv-product').value;
  const quantity = parseInt(document.getElementById('admin-inv-quantity').value);
  const warehouseLocation = document.getElementById('admin-inv-warehouse').value;

  // Check if inventory already exists for this product
  const existing = await apiFetch('/api/inventory/product/' + productId);
  let res;
  if (existing.ok && existing.data) {
    // Inventory exists — add to current quantity via PUT
    const newQuantity = (existing.data.quantity || 0) + quantity;
    res = await apiFetch('/api/inventory/product/' + productId, {
      method: 'PUT',
      body: JSON.stringify({ quantity: newQuantity }),
    });
  } else {
    // No inventory yet — create it via POST
    res = await apiFetch('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        quantity,
        warehouseLocation,
      }),
    });
  }

  if (res.ok && res.data) {
    const productName = state.products.find(p => p.id === productId)?.name || productId;
    showAdminMessage('Added ' + quantity + ' units to "' + productName + '"');
    addEventLogEntry('INVENTORY_UPDATED', productName + ': +' + quantity + ' units');
    // Clear form
    document.getElementById('admin-inv-product').value = '';
    document.getElementById('admin-inv-quantity').value = '';
    document.getElementById('admin-inv-warehouse').value = '';
  } else {
    const errMsg = (res.data && res.data.error && res.data.error.message) || 'Failed to add inventory';
    showAdminMessage(errMsg, true);
  }
}

// Delete Product
async function handleDeleteProduct(e) {
  e.preventDefault();

  if (!state.user || state.user.role !== 'admin') {
    showAdminMessage('Only admin can delete products', true);
    return;
  }

  const productId = document.getElementById('admin-delete-product').value;
  const productName = state.products.find(p => p.id === productId)?.name || productId;

  if (!confirm('Are you sure you want to delete "' + productName + '"?')) {
    return;
  }

  const res = await apiFetch('/api/products/' + productId, {
    method: 'DELETE',
  });

  if (res.ok) {
    showAdminMessage('Product "' + productName + '" deleted');
    addEventLogEntry('PRODUCT_DELETED', productName + ' removed from catalog');
    // Clear form
    document.getElementById('admin-delete-product').value = '';
    // Reload products
    await loadProducts();
    populateAdminDropdowns();
  } else {
    const errMsg = (res.data && res.data.error && res.data.error.message) || 'Failed to delete product';
    showAdminMessage(errMsg, true);
  }
}

async function checkServiceHealth() {
  const apiDot = document.getElementById('api-status');
  const dbDot = document.getElementById('db-status');
  const kafkaDot = document.getElementById('kafka-status');

  try {
    const res = await fetch(API_BASE + '/health', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      apiDot.className = 'status-dot green';
      dbDot.className = 'status-dot green';
      kafkaDot.className = 'status-dot green';
    } else {
      apiDot.className = 'status-dot yellow';
      dbDot.className = 'status-dot yellow';
      kafkaDot.className = 'status-dot yellow';
    }
  } catch {
    apiDot.className = 'status-dot red';
    dbDot.className = 'status-dot yellow';
    kafkaDot.className = 'status-dot yellow';
  }
}

function refreshAdminPanel() {
  checkServiceHealth();
  populateAdminDropdowns();
  const throughput = 1200 + Math.floor(Math.random() * 100);
  const latency = 400 + Math.floor(Math.random() * 50);
  const errorRate = (0.2 + Math.random() * 0.2).toFixed(1);
  document.getElementById('metric-throughput').textContent = throughput.toLocaleString();
  document.getElementById('metric-latency').textContent = latency;
  document.getElementById('metric-error').textContent = errorRate + '%';
}

// ==================== EVENT LOG ====================
const MAX_LOG_ENTRIES = 50;

function addEventLogEntry(type, message) {
  const log = document.getElementById('event-log');
  if (!log) return;

  const now = new Date();
  const ts = now.toLocaleTimeString('en-GB');

  const entry = document.createElement('div');
  entry.className = 'event-log-entry';
  entry.innerHTML = `<span class="timestamp">[${ts}]</span> <span class="event-type">${type}</span> <span class="event-msg">${escapeHtml(message)}</span>`;

  log.insertBefore(entry, log.firstChild);

  while (log.children.length > MAX_LOG_ENTRIES) {
    log.removeChild(log.lastChild);
  }
}

function startEventLog() {
  addEventLogEntry('SYSTEM', 'CloudRetail Frontend initialized');
  addEventLogEntry('SYSTEM', 'Connecting to API Gateway at ' + API_BASE);
  addEventLogEntry('AWS_EKS', 'Kubernetes cluster: cloudretail-cluster (ap-southeast-1)');
  addEventLogEntry('AWS_RDS', 'PostgreSQL instance online (5 databases)');
  addEventLogEntry('AWS_MSK', 'Kafka broker connected');
  addEventLogEntry('AWS_ELASTICACHE', 'Redis cache connected');

  const events = [
    ['KAFKA_EVENT', 'inventory-update: stock changed'],
    ['KAFKA_EVENT', 'price-change: product price updated'],
    ['HEALTH_CHECK', 'All 7 services responding (200 OK)'],
    ['AWS_CLOUDWATCH', 'Metrics published to AMP workspace'],
    ['CACHE_HIT', 'Redis: product catalog cache hit (87% rate)'],
    ['AWS_ALB', 'Request routed to user-service replica'],
    ['KAFKA_EVENT', 'order-status: order shipped'],
    ['HPA_SCALING', 'product-service scaled to 4 replicas (CPU 72%)'],
    ['AWS_S3', 'Static assets served via CloudFront CDN'],
    ['CIRCUIT_BREAKER', 'payment-service circuit: CLOSED (healthy)'],
    ['KAFKA_EVENT', 'user-registered: new customer'],
    ['AWS_ROUTE53', 'DNS health check passed for ap-southeast-1'],
  ];

  let idx = 0;
  setInterval(() => {
    const [type, msg] = events[idx % events.length];
    addEventLogEntry(type, msg);
    idx++;
  }, 8000);
}

// ==================== TOASTS ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// ==================== UTILITIES ====================
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
