// Products will be fetched from Backend API
let products = [];

// DOM Elements
const productGrid = document.getElementById('productGrid');
const dealCount = document.getElementById('dealCount');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const toast = document.getElementById('toast');
const categoryFilters = document.querySelectorAll('#categoryFilters input');
const retailerFilters = document.querySelectorAll('#retailerFilters input');
const minPriceInput = document.getElementById('minPrice');
const maxPriceInput = document.getElementById('maxPrice');
const applyPriceBtn = document.getElementById('applyPriceBtn');
const clearFiltersBtn = document.getElementById('clearFilters');
const sortTabs = document.querySelectorAll('.sort-tab');

// Drawer Elements
const menuDrawerBtn = document.getElementById('menuDrawerBtn');
const categoryDrawer = document.getElementById('categoryDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const drawerMenuItems = document.querySelectorAll('.drawer-menu li');

// Utility: Format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

// State
let currentProducts = [...products];

// Render Products
const renderProducts = (items) => {
    productGrid.innerHTML = '';
    
    if (items.length === 0) {
        productGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h3>No deals found</h3>
                <p>Try adjusting your filters or search query.</p>
            </div>
        `;
        dealCount.textContent = `0 deals found`;
        return;
    }

    dealCount.textContent = `Choose from ${items.length} top deals`;

    items.forEach(product => {
        const discountPercentage = Math.round(((product.originalPrice - product.discountPrice) / product.originalPrice) * 100);
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            ${product.badge ? `<div class="card-badge">${product.badge}</div>` : ''}
            <div class="card-image-wrapper ${product.bgColor || ''}">
                <span class="retailer-tag ${product.retailer.toLowerCase()}">${product.retailer}</span>
                <img src="${product.image}" alt="${product.title}" class="product-img" onerror="this.src='https://via.placeholder.com/200?text=No+Image'">
            </div>
            <div class="card-body">
                <h3 class="product-title">${product.title}</h3>
                <div class="product-pricing">
                    <span class="current-price">${formatCurrency(product.discountPrice)}</span>
                    <span class="original-price">${formatCurrency(product.originalPrice)}</span>
                </div>
                <div class="profit-info">
                    <i class="fa-solid fa-coins"></i> ${product.profit}
                </div>
                <div class="card-actions">
                    <button class="btn-copy" onclick="copyToClipboard('${product.affiliateLink}')" title="Copy Affiliate Link">
                        <i class="fa-regular fa-copy"></i> Copy
                    </button>
                    <a href="${product.affiliateLink}" target="_blank" rel="noopener noreferrer" class="btn-buy" title="Go to Store">
                        <i class="fa-solid fa-cart-shopping"></i> Shop Now
                    </a>
                </div>
            </div>
        `;
        productGrid.appendChild(card);
    });
};

// Copy to Clipboard feature
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Affiliate link copied to clipboard!');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showToast('Failed to copy link');
    });
};

// Toast notification
let toastTimeout;
const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

// Filtering Logic
const applyFilters = () => {
    const searchTerm = searchInput.value.toLowerCase();
    
    // Get active checkboxes
    const activeCategories = Array.from(categoryFilters).filter(cb => cb.checked).map(cb => cb.value);
    const activeRetailers = Array.from(retailerFilters).filter(cb => cb.checked).map(cb => cb.value);
    
    const minPrice = minPriceInput.value ? parseFloat(minPriceInput.value) : 0;
    const maxPrice = maxPriceInput.value ? parseFloat(maxPriceInput.value) : Infinity;

    currentProducts = products.filter(product => {
        // Search
        const matchesSearch = product.title.toLowerCase().includes(searchTerm) || 
                              product.category.toLowerCase().includes(searchTerm);
        
        // Category
        const matchesCategory = activeCategories.length === 0 || activeCategories.includes(product.category);
        
        // Retailer
        const matchesRetailer = activeRetailers.length === 0 || activeRetailers.includes(product.retailer);
        
        // Price
        const matchesPrice = product.discountPrice >= minPrice && product.discountPrice <= maxPrice;

        return matchesSearch && matchesCategory && matchesRetailer && matchesPrice;
    });

    renderProducts(currentProducts);
};

// Event Listeners for Filters
searchInput.addEventListener('input', applyFilters);
categoryFilters.forEach(cb => cb.addEventListener('change', applyFilters));
retailerFilters.forEach(cb => cb.addEventListener('change', applyFilters));
applyPriceBtn.addEventListener('click', applyFilters);

clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    categoryFilters.forEach(cb => cb.checked = false);
    retailerFilters.forEach(cb => cb.checked = false);
    minPriceInput.value = '';
    maxPriceInput.value = '';
    
    // Reset Sorting active state
    sortTabs.forEach(t => t.classList.remove('active'));
    sortTabs[0].classList.add('active'); // default Popularity
    
    currentProducts = [...products];
    renderProducts(currentProducts);
});

// Sorting Logic
sortTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        // Update active tab styling
        sortTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const sortType = e.target.getAttribute('data-sort');
        
        switch(sortType) {
            case 'price-low':
                currentProducts.sort((a, b) => a.discountPrice - b.discountPrice);
                break;
            case 'price-high':
                currentProducts.sort((a, b) => b.discountPrice - a.discountPrice);
                break;
            case 'discount':
                currentProducts.sort((a, b) => {
                    const discountA = (a.originalPrice - a.discountPrice) / a.originalPrice;
                    const discountB = (b.originalPrice - b.discountPrice) / b.originalPrice;
                    return discountB - discountA;
                });
                break;
            case 'popularity':
            default:
                // For mock data, assume ID order is popularity
                currentProducts.sort((a, b) => a.id - b.id);
                break;
        }
        
        renderProducts(currentProducts);
    });
});

// --- Drawer Logic ---
const openDrawer = () => {
    categoryDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
};
const closeDrawer = () => {
    categoryDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
};

menuDrawerBtn.addEventListener('click', openDrawer);
closeDrawerBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

drawerMenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        const selectedCategory = e.currentTarget.getAttribute('data-category');
        
        // Uncheck all sidebar checkboxes to override with drawer category
        categoryFilters.forEach(cb => cb.checked = false);
        retailerFilters.forEach(cb => cb.checked = false);
        searchInput.value = '';
        
        // Filter products specifically by this drawer category
        currentProducts = products.filter(p => p.category === selectedCategory);
        renderProducts(currentProducts);
        
        closeDrawer();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
// --------------------

// Initial Render & Data Fetching
const initializeApp = async () => {
    try {
        const res = await fetch('http://localhost:3000/api/products');
        if (res.ok) {
            products = await res.json();
            currentProducts = [...products];
            renderProducts(currentProducts);
        } else {
            productGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to load products from backend.</div>';
        }
    } catch (err) {
        console.error('Error fetching products:', err);
        productGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Cannot connect to backend server. Is it running?</div>';
    }
};

initializeApp();
