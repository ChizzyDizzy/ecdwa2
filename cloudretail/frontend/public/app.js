/* ========================================
   CloudRetail - Frontend Application
   Connects to API Gateway on port 8080
   ======================================== */

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8080'
  : window.location.origin;

// ==================== STATE ====================
let state = {
  token: localStorage.getItem('cr_token') || null,
  user: JSON.parse(localStorage.getItem('cr_user') || 'null'),
  cart: JSON.parse(localStorage.getItem('cr_cart') || '[]'),
  products: [],
  orders: [],
  currentPage: 'home',
};

// ==================== DEMO DATA ====================
// Fallback products when backend is not running
const DEMO_PRODUCTS = [
  { id: 'p001', name: 'Wireless Gaming Headset', description: 'Premium 7.1 surround sound headset with RGB lighting and noise cancellation.', price: 79.99, category: 'electronics', sku: 'WGH-001', vendorId: 'v001', isActive: true },
  { id: 'p002', name: 'Mechanical Keyboard RGB', description: 'Cherry MX Blue switches, full RGB backlight, aluminium frame.', price: 129.99, category: 'electronics', sku: 'MKR-002', vendorId: 'v001', isActive: true },
  { id: 'p003', name: 'Ultra-Wide Monitor 34"', description: '34-inch curved display, 3440x1440, 144Hz refresh rate, HDR400.', price: 449.99, category: 'electronics', sku: 'UWM-003', vendorId: 'v002', isActive: true },
  { id: 'p004', name: 'Cloud Architecture Handbook', description: 'Comprehensive guide to designing scalable cloud systems on AWS.', price: 34.99, category: 'books', sku: 'CAH-004', vendorId: 'v003', isActive: true },
  { id: 'p005', name: 'Microservices Patterns', description: 'Practical patterns for building event-driven distributed systems.', price: 44.99, category: 'books', sku: 'MSP-005', vendorId: 'v003', isActive: true },
  { id: 'p006', name: 'Developer Hoodie - Black', description: 'Premium cotton blend hoodie, perfect for late-night coding sessions.', price: 59.99, category: 'clothing', sku: 'DHB-006', vendorId: 'v004', isActive: true },
  { id: 'p007', name: 'Standing Desk Electric', description: 'Electric height-adjustable desk, memory presets, cable management.', price: 349.99, category: 'home', sku: 'SDE-007', vendorId: 'v005', isActive: true },
  { id: 'p008', name: 'Ergonomic Office Chair', description: 'Mesh back, lumbar support, adjustable armrests, 5-year warranty.', price: 299.99, category: 'home', sku: 'EOC-008', vendorId: 'v005', isActive: true },
  { id: 'p009', name: 'Fitness Tracker Pro', description: 'Heart rate, GPS, sleep tracking, 7-day battery, waterproof.', price: 89.99, category: 'sports', sku: 'FTP-009', vendorId: 'v006', isActive: true },
  { id: 'p010', name: 'Yoga Mat Premium', description: 'Extra thick, non-slip surface, eco-friendly materials, carry strap.', price: 29.99, category: 'sports', sku: 'YMP-010', vendorId: 'v006', isActive: true },
  { id: 'p011', name: 'USB-C Docking Station', description: 'Triple display support, 100W PD charging, 10Gbps data transfer.', price: 159.99, category: 'electronics', sku: 'UCD-011', vendorId: 'v001', isActive: true },
  { id: 'p012', name: 'Kubernetes in Action', description: 'Deep dive into container orchestration with real-world examples.', price: 39.99, category: 'books', sku: 'KIA-012', vendorId: 'v003', isActive: true },
];

const DEMO_INVENTORY = [
  { productId: 'p001', productName: 'Wireless Gaming Headset', sku: 'WGH-001', quantity: 150, reservedQuantity: 12 },
  { productId: 'p002', productName: 'Mechanical Keyboard RGB', sku: 'MKR-002', quantity: 85, reservedQuantity: 5 },
  { productId: 'p003', productName: 'Ultra-Wide Monitor 34"', sku: 'UWM-003', quantity: 30, reservedQuantity: 8 },
  { productId: 'p004', productName: 'Cloud Architecture Handbook', sku: 'CAH-004', quantity: 500, reservedQuantity: 0 },
  { productId: 'p005', productName: 'Microservices Patterns', sku: 'MSP-005', quantity: 320, reservedQuantity: 3 },
  { productId: 'p006', productName: 'Developer Hoodie - Black', sku: 'DHB-006', quantity: 200, reservedQuantity: 15 },
  { productId: 'p007', productName: 'Standing Desk Electric', sku: 'SDE-007', quantity: 8, reservedQuantity: 2 },
  { productId: 'p008', productName: 'Ergonomic Office Chair', sku: 'EOC-008', quantity: 22, reservedQuantity: 4 },
  { productId: 'p009', productName: 'Fitness Tracker Pro', sku: 'FTP-009', quantity: 175, reservedQuantity: 20 },
  { productId: 'p010', productName: 'Yoga Mat Premium', sku: 'YMP-010', quantity: 0, reservedQuantity: 0 },
  { productId: 'p011', productName: 'USB-C Docking Station', sku: 'UCD-011', quantity: 60, reservedQuantity: 7 },
  { productId: 'p012', productName: 'Kubernetes in Action', sku: 'KIA-012', quantity: 410, reservedQuantity: 1 },
];

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
  loadProducts();
  checkServiceHealth();
  startEventLog();
  // Check health periodically
  setInterval(checkServiceHealth, 30000);
});

// ==================== NAVIGATION ====================
function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (btn) btn.classList.add('active');

  // Load data for specific pages
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
  } else if (res.ok && res.data && res.data.token) {
    state.token = res.data.token;
    state.user = res.data.user;
    localStorage.setItem('cr_token', state.token);
    localStorage.setItem('cr_user', JSON.stringify(state.user));
    updateAuthUI();
    closeModal('login');
    showToast('Welcome back, ' + state.user.firstName + '!', 'success');
    addEventLogEntry('USER_LOGIN', state.user.email + ' authenticated via JWT');
  } else {
    const errMsg = (res.data && res.data.error && res.data.error.message) || 'Login failed';
    const errorEl = document.getElementById('login-error');
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
    } else {
      closeModal('register');
      showToast('Account created! You can now log in.', 'success');
      addEventLogEntry('USER_REGISTERED', email + ' - GDPR consent recorded');
      showModal('login');
    }
  } else {
    const errMsg = (res.data && res.data.error && res.data.error.message) || 'Registration failed';
    const errorEl = document.getElementById('register-error');
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

  const res = await apiFetch('/api/products/products');

  let products;
  if (res.ok && res.data && res.data.data) {
    const d = res.data.data;
    products = Array.isArray(d) ? d : d.products || [];
    addEventLogEntry('PRODUCTS_LOADED', products.length + ' items from Product Service');
  } else {
    products = [];
    addEventLogEntry('PRODUCTS_LOADED', 'Product Service offline');
  }

  state.products = products;
  loading.classList.remove('active');
  renderProducts(products);
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">?</div><p>No products found</p></div>';
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
    quantity: c.quantity,
    price: c.price,
  }));

  const totalAmount = state.cart.reduce((sum, c) => sum + c.price * c.quantity, 0) + 5.99;

  addEventLogEntry('ORDER_INITIATED', 'Creating order via Saga pattern...');

  const res = await apiFetch('/api/orders/orders', {
    method: 'POST',
    body: JSON.stringify({ items, shippingAddress: address, totalAmount }),
  });

  if (res.ok && res.data) {
    addEventLogEntry('ORDER_CREATED', 'Order ID: ' + (res.data.data?.id || 'confirmed'));
    addEventLogEntry('INVENTORY_RESERVED', 'Stock reserved via Inventory Service');
    addEventLogEntry('PAYMENT_PROCESSED', 'Payment completed via Payment Service');
    addEventLogEntry('EVENT_PUBLISHED', 'order-created event sent to Kafka on AWS MSK');
  } else {
    // Demo mode
    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
    addEventLogEntry('ORDER_CREATED', 'Order ' + orderId + ' (demo mode)');
    addEventLogEntry('INVENTORY_RESERVED', 'Stock reserved (demo)');
    addEventLogEntry('PAYMENT_PROCESSED', 'Payment $' + totalAmount.toFixed(2) + ' processed (demo)');
    addEventLogEntry('EVENT_PUBLISHED', 'Kafka event published (demo)');

    // Store demo order
    const demoOrders = JSON.parse(localStorage.getItem('cr_demo_orders') || '[]');
    demoOrders.push({
      id: orderId,
      items: state.cart.map(c => ({ ...c })),
      totalAmount,
      shippingAddress: address,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('cr_demo_orders', JSON.stringify(demoOrders));
  }

  // Clear cart and show success
  state.cart = [];
  saveCart();
  updateCartCount();
  showModal('order-success');
}

async function loadOrders() {
  if (!state.token) return;

  const ordersContainer = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');
  const loginPrompt = document.getElementById('orders-login-prompt');

  loginPrompt.classList.add('hidden');
  ordersContainer.innerHTML = '';

  // Try API first
  const res = await apiFetch('/api/orders/orders');

  let orders = [];
  if (res.ok && res.data && res.data.data) {
    orders = Array.isArray(res.data.data) ? res.data.data : [];
    addEventLogEntry('ORDERS_LOADED', orders.length + ' orders from Order Service');
  }

  // Merge demo orders
  const demoOrders = JSON.parse(localStorage.getItem('cr_demo_orders') || '[]');
  orders = [...orders, ...demoOrders];

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

  let inventory = DEMO_INVENTORY;

  // Try to load from API for each known product
  for (const item of inventory) {
    const res = await apiFetch('/api/inventory/product/' + item.productId);
    if (res.ok && res.data && res.data.data) {
      item.quantity = res.data.data.quantity || item.quantity;
      item.reservedQuantity = res.data.data.reservedQuantity || item.reservedQuantity;
    }
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
  // Simulate live metrics with small variations
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

  // Trim old entries
  while (log.children.length > MAX_LOG_ENTRIES) {
    log.removeChild(log.lastChild);
  }
}

function startEventLog() {
  addEventLogEntry('SYSTEM', 'CloudRetail Frontend initialized');
  addEventLogEntry('SYSTEM', 'Connecting to API Gateway at ' + API_BASE);
  addEventLogEntry('AWS_EKS', 'Kubernetes cluster: cloudretail-cluster (eu-west-1)');
  addEventLogEntry('AWS_RDS', '5x PostgreSQL databases online');
  addEventLogEntry('AWS_MSK', 'Kafka broker connected');
  addEventLogEntry('AWS_ELASTICACHE', 'Redis cache connected');

  // Simulated background events
  const events = [
    ['KAFKA_EVENT', 'inventory-update: product p003 stock changed'],
    ['KAFKA_EVENT', 'price-change: product p001 price updated'],
    ['HEALTH_CHECK', 'All 7 services responding (200 OK)'],
    ['AWS_CLOUDWATCH', 'Metrics published to AMP workspace'],
    ['CACHE_HIT', 'Redis: product catalog cache hit (87% rate)'],
    ['AWS_ALB', 'Request routed to user-service replica-2'],
    ['KAFKA_EVENT', 'order-status: ORD-x8k7 shipped'],
    ['HPA_SCALING', 'product-service scaled to 4 replicas (CPU 72%)'],
    ['AWS_S3', 'Static assets served via CloudFront CDN'],
    ['CIRCUIT_BREAKER', 'payment-service circuit: CLOSED (healthy)'],
    ['KAFKA_EVENT', 'user-registered: new customer in EU region'],
    ['AWS_ROUTE53', 'DNS health check passed for eu-west-1'],
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
