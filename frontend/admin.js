// ============================================
// ADMIN DASHBOARD JAVASCRIPT - CUSTOMER MANAGEMENT
// ============================================

let allCustomers = [];
let filteredCustomers = [];
let deleteConfirmId = null;
let visitConfirmId = null;
let currentLanguage = 'en'; // 'en' or 'hi'

// DOM Elements
const tableBody = document.getElementById('tableBody');
const noAppointments = document.getElementById('noAppointments');
const appointmentsTable = document.getElementById('appointmentsTable');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const totalCount = document.getElementById('totalCount');
const todayCount = document.getElementById('todayCount');
const upcomingCount = document.getElementById('upcomingCount');
const exportBtn = document.getElementById('exportBtn');
const refreshBtn = document.getElementById('refreshBtn');
const deleteModal = document.getElementById('deleteModal');
const visitModal = document.getElementById('visitModal');
const confirmDelete = document.getElementById('confirmDelete');
const cancelDelete = document.getElementById('cancelDelete');
const confirmVisit = document.getElementById('confirmVisit');
const cancelVisit = document.getElementById('cancelVisit');
const langToggle = document.getElementById('langToggle');

// ============================================
// LANGUAGE MANAGEMENT
// ============================================

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('adminLanguage', lang);
    
    // Update all elements with data-en and data-hi attributes
    document.querySelectorAll('[data-en][data-hi]').forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = lang === 'en' ? el.dataset.en : el.dataset.hi;
        } else if (el.tagName === 'OPTION') {
            el.textContent = lang === 'en' ? el.dataset.en : el.dataset.hi;
        } else {
            el.textContent = lang === 'en' ? el.dataset.en : el.dataset.hi;
        }
    });
    
    // Update header title
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        headerTitle.textContent = lang === 'en' ? '📋 Customer Management' : '📋 ग्राहक प्रबंधन';
    }
    
    // Update language toggle button
    if (langToggle) {
        langToggle.textContent = lang === 'en' ? '🌐 हिंदी' : '🌐 English';
    }
    
    renderCustomers();
}

function toggleLanguage() {
    setLanguage(currentLanguage === 'en' ? 'hi' : 'en');
}

// ============================================
// LOAD CUSTOMERS FROM API
// ============================================

async function loadCustomers() {
    try {
        const response = await fetch('http://localhost:4000/patients');
        if (!response.ok) throw new Error('Failed to fetch customers');
        
        allCustomers = await response.json();
        filteredCustomers = [...allCustomers];
        updateStats();
        renderCustomers();
    } catch (error) {
        console.error('Error loading customers:', error);
        showNotification('Error loading customers: ' + error.message, 'error');
    }
}

// ============================================
// RENDER CUSTOMERS TABLE
// ============================================

function renderCustomers() {
    if (filteredCustomers.length === 0) {
        noAppointments.style.display = 'block';
        appointmentsTable.style.display = 'none';
        return;
    }

    noAppointments.style.display = 'none';
    appointmentsTable.style.display = 'block';

    tableBody.innerHTML = '';

    filteredCustomers.forEach(customer => {
        const row = document.createElement('tr');
        const lastVisitDate = customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : 'N/A';
        const isToday = isVisitedToday(customer.lastVisit);
        
        row.innerHTML = `
            <td class="col-patient">${escapeHtml(customer.name)}</td>
            <td class="col-issue">${customer.visits || 0}</td>
            <td class="col-date">${lastVisitDate}</td>
            <td class="col-status">
                <span class="status-badge status-confirmed">${currentLanguage === 'en' ? 'ACTIVE' : 'सक्रिय'}</span>
            </td>
            <td class="col-actions">
                <div class="action-buttons">
                    <button class="btn-primary" onclick="openVisitModal('${escapeHtml(customer.name)}', '${escapeHtml(customer.name)}')">+Visit</button>
                    <button class="btn-delete" onclick="openDeleteModal('${escapeHtml(customer.name)}', '${escapeHtml(customer.name)}')">Delete</button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// ============================================
// CHECK IF VISITED TODAY
// ============================================

function isVisitedToday(lastVisitDate) {
    if (!lastVisitDate) return false;
    
    const today = new Date();
    const visitDate = new Date(lastVisitDate);
    
    return today.toDateString() === visitDate.toDateString();
}

// ============================================
// UPDATE STATS
// ============================================

function updateStats() {
    let todayVisits = 0;
    let totalVisits = 0;

    allCustomers.forEach(customer => {
        if (isVisitedToday(customer.lastVisit)) {
            todayVisits++;
        }
        totalVisits += customer.visits || 0;
    });

    totalCount.textContent = allCustomers.length;
    todayCount.textContent = todayVisits;
    upcomingCount.textContent = totalVisits;
}

// ============================================
// SEARCH AND FILTER
// ============================================

function filterCustomers() {
    const searchTerm = searchInput.value.toLowerCase();
    
    filteredCustomers = allCustomers.filter(customer => {
        const name = customer.name.toLowerCase();
        return name.includes(searchTerm);
    });

    sortCustomers();
    renderCustomers();
}

function sortCustomers() {
    const sortValue = sortSelect.value;

    switch (sortValue) {
        case 'visits-desc':
            filteredCustomers.sort((a, b) => (b.visits || 0) - (a.visits || 0));
            break;
        case 'visits-asc':
            filteredCustomers.sort((a, b) => (a.visits || 0) - (b.visits || 0));
            break;
        case 'name-asc':
            filteredCustomers.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filteredCustomers.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'recent':
            filteredCustomers.sort((a, b) => new Date(b.lastVisit || 0) - new Date(a.lastVisit || 0));
            break;
    }

    renderCustomers();
}

// ============================================
// DELETE CUSTOMER
// ============================================

function openDeleteModal(id, name) {
    deleteConfirmId = id;
    document.getElementById('deletePatientName').textContent = name;
    document.getElementById('deletePatientInfo').textContent = `Visits: ${allCustomers.find(c => c.name === id)?.visits || 0}`;
    deleteModal.classList.add('show');
    deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
    deleteModal.classList.remove('show');
    deleteModal.style.display = 'none';
    deleteConfirmId = null;
}

async function deleteCustomer() {
    try {
        allCustomers = allCustomers.filter(c => c.name !== deleteConfirmId);
        
        // Update the database
        const response = await fetch('http://localhost:4000/patients', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: deleteConfirmId })
        });
        
        if (!response.ok) throw new Error('Failed to delete customer');
        
        closeDeleteModal();
        await loadCustomers();
        
        showNotification(currentLanguage === 'en' ? 'Customer deleted successfully' : 'ग्राहक को सफलतापूर्वक हटा दिया गया');
    } catch (error) {
        console.error('Error deleting customer:', error);
        showNotification('Error deleting customer', 'error');
    }
}

// ============================================
// RECORD VISIT
// ============================================

function openVisitModal(id, name) {
    visitConfirmId = id;
    document.getElementById('visitPatientName').textContent = name;
    visitModal.classList.add('show');
    visitModal.style.display = 'flex';
}

function closeVisitModal() {
    visitModal.classList.remove('show');
    visitModal.style.display = 'none';
    visitConfirmId = null;
}

async function recordVisit() {
    try {
        const response = await fetch('http://localhost:4000/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: visitConfirmId })
        });
        
        if (!response.ok) throw new Error('Failed to record visit');
        
        closeVisitModal();
        await loadCustomers();
        
        showNotification(currentLanguage === 'en' ? 'Visit recorded successfully' : 'दौरा सफलतापूर्वक रिकॉर्ड किया गया');
    } catch (error) {
        console.error('Error recording visit:', error);
        showNotification('Error recording visit', 'error');
    }
}

// ============================================
// EXPORT FUNCTIONALITY
// ============================================

function exportCustomers() {
    if (allCustomers.length === 0) {
        showNotification(currentLanguage === 'en' ? 'No customers to export' : 'निर्यात करने के लिए कोई ग्राहक नहीं');
        return;
    }

    let csvContent = 'Customer Name,Total Visits,Last Visit\n';
    
    allCustomers.forEach(customer => {
        const lastVisit = customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : 'N/A';
        csvContent += `"${customer.name}","${customer.visits || 0}","${lastVisit}"\n`;
    });

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showNotification(currentLanguage === 'en' ? 'Customers exported successfully' : 'ग्राहकों को सफलतापूर्वक निर्यात किया गया');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const bgColor = type === 'error' ? '#ef4444' : '#10b981';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        z-index: 2000;
        animation: slideInDown 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutUp 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// EVENT LISTENERS
// ============================================

if (searchInput) searchInput.addEventListener('input', filterCustomers);
if (sortSelect) sortSelect.addEventListener('change', sortCustomers);
if (exportBtn) exportBtn.addEventListener('click', exportCustomers);
if (refreshBtn) refreshBtn.addEventListener('click', () => {
    loadCustomers();
    showNotification(currentLanguage === 'en' ? 'Customers refreshed' : 'ग्राहक रीफ्रेश हो गए');
});

if (confirmDelete) confirmDelete.addEventListener('click', deleteCustomer);
if (cancelDelete) cancelDelete.addEventListener('click', closeDeleteModal);

if (confirmVisit) confirmVisit.addEventListener('click', recordVisit);
if (cancelVisit) cancelVisit.addEventListener('click', closeVisitModal);

if (langToggle) langToggle.addEventListener('click', toggleLanguage);

// Close modal when clicking outside
if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });
}

if (visitModal) {
    visitModal.addEventListener('click', (e) => {
        if (e.target === visitModal) {
            closeVisitModal();
        }
    });
}

// ============================================
// AUTO-REFRESH (every 10 seconds)
// ============================================

setInterval(() => {
    loadCustomers();
}, 10000);

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('adminLanguage') || 'en';
    currentLanguage = savedLanguage;
    
    // Initialize language UI - show the language to switch TO
    if (langToggle) {
        langToggle.textContent = currentLanguage === 'en' ? '🌐 हिंदी' : '🌐 English';
        langToggle.style.padding = '12px 15px';
        langToggle.style.borderRadius = '8px';
        langToggle.style.background = 'rgba(255, 255, 255, 0.1)';
        langToggle.style.color = 'white';
        langToggle.style.fontWeight = '500';
        langToggle.style.transition = 'all 0.3s ease';
    }

    setLanguage(currentLanguage);
    loadCustomers();

    // Add animation styles to document
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes slideOutUp {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-20px);
            }
        }
        
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .modal.show {
            display: flex;
        }
        
        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 5px 30px rgba(0, 0, 0, 0.2);
            max-width: 400px;
            width: 90%;
        }
        
        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
        }
        
        .btn-primary {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
        }
        
        .btn-primary:hover {
            background: #2563eb;
        }
    `;
    document.head.appendChild(style);
});
