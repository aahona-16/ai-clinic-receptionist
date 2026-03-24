// ============================================
// ADMIN DASHBOARD JAVASCRIPT
// ============================================

let allAppointments = [];
let filteredAppointments = [];
let deleteConfirmId = null;

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
const confirmDelete = document.getElementById('confirmDelete');
const cancelDelete = document.getElementById('cancelDelete');

// ============================================
// LOAD APPOINTMENTS
// ============================================

function loadAppointments() {
    const stored = localStorage.getItem('appointments');
    allAppointments = stored ? JSON.parse(stored) : [];
    filteredAppointments = [...allAppointments];
    updateStats();
    renderAppointments();
}

// ============================================
// RENDER APPOINTMENTS TABLE
// ============================================

function renderAppointments() {
    if (filteredAppointments.length === 0) {
        noAppointments.style.display = 'block';
        appointmentsTable.style.display = 'none';
        return;
    }

    noAppointments.style.display = 'none';
    appointmentsTable.style.display = 'block';

    tableBody.innerHTML = '';

    filteredAppointments.forEach(appointment => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="col-patient">${escapeHtml(appointment.name)}</td>
            <td class="col-issue">${escapeHtml(appointment.issue)}</td>
            <td class="col-date">${appointment.date}</td>
            <td class="col-time">${appointment.time}</td>
            <td class="col-status">
                <span class="status-badge status-confirmed">CONFIRMED</span>
            </td>
            <td class="col-actions">
                <div class="action-buttons">
                    <button class="btn-delete" onclick="openDeleteModal('${appointment.id}', '${appointment.name}', '${appointment.date}', '${appointment.time}')">Delete</button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// ============================================
// UPDATE STATS
// ============================================

function updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    let todayAppointments = 0;
    let upcomingAppointments = 0;

    allAppointments.forEach(appointment => {
        const [year, month, day] = appointment.date.split('-');
        const appointmentDate = new Date(year, month - 1, day);
        appointmentDate.setHours(0, 0, 0, 0);

        if (appointmentDate.getTime() === today.getTime()) {
            todayAppointments++;
        }

        if (appointmentDate >= today && appointmentDate <= sevenDaysFromNow) {
            upcomingAppointments++;
        }
    });

    totalCount.textContent = allAppointments.length;
    todayCount.textContent = todayAppointments;
    upcomingCount.textContent = upcomingAppointments;
}

// ============================================
// SEARCH AND FILTER
// ============================================

function filterAppointments() {
    const searchTerm = searchInput.value.toLowerCase();
    
    filteredAppointments = allAppointments.filter(appointment => {
        const name = appointment.name.toLowerCase();
        const issue = appointment.issue.toLowerCase();
        return name.includes(searchTerm) || issue.includes(searchTerm);
    });

    sortAppointments();
    renderAppointments();
}

function sortAppointments() {
    const sortValue = sortSelect.value;

    switch (sortValue) {
        case 'date-asc':
            filteredAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'date-desc':
            filteredAppointments.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'name-asc':
            filteredAppointments.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filteredAppointments.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }

    renderAppointments();
}

// ============================================
// DELETE APPOINTMENT
// ============================================

function openDeleteModal(id, name, date, time) {
    deleteConfirmId = id;
    document.getElementById('deletePatientName').textContent = name;
    document.getElementById('deletePatientInfo').textContent = `${date} at ${time}`;
    deleteModal.classList.add('show');
}

function closeDeleteModal() {
    deleteModal.classList.remove('show');
    deleteConfirmId = null;
}

function deleteAppointment() {
    allAppointments = allAppointments.filter(a => a.id != deleteConfirmId);
    localStorage.setItem('appointments', JSON.stringify(allAppointments));
    
    closeDeleteModal();
    loadAppointments();
    
    showNotification('Appointment deleted successfully');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
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
// EXPORT FUNCTIONALITY
// ============================================

function exportAppointments() {
    if (allAppointments.length === 0) {
        showNotification('No appointments to export');
        return;
    }

    // Create CSV content
    let csvContent = 'Patient Name,Dental Issue,Date,Time,Created At\n';
    
    allAppointments.forEach(appointment => {
        const createdAt = appointment.createdAt ? new Date(appointment.createdAt).toLocaleDateString('en-US') : 'N/A';
        csvContent += `"${appointment.name}","${appointment.issue}","${appointment.date}","${appointment.time}","${createdAt}"\n`;
    });

    // Download CSV
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', `appointments_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showNotification('Appointments exported successfully');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// EVENT LISTENERS
// ============================================

if (searchInput) searchInput.addEventListener('input', filterAppointments);
if (sortSelect) sortSelect.addEventListener('change', sortAppointments);
if (exportBtn) exportBtn.addEventListener('click', exportAppointments);
if (refreshBtn) refreshBtn.addEventListener('click', () => {
    loadAppointments();
    showNotification('Appointments refreshed');
});

if (confirmDelete) confirmDelete.addEventListener('click', deleteAppointment);
if (cancelDelete) cancelDelete.addEventListener('click', closeDeleteModal);

// Close modal when clicking outside
if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });
}

// ============================================
// AUTO-REFRESH (every 10 seconds)
// ============================================

setInterval(() => {
    loadAppointments();
}, 10000);

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadAppointments();

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
    `;
    document.head.appendChild(style);
});

// ============================================
// LOAD APPOINTMENTS
// ============================================

function loadAppointments() {
    const stored = localStorage.getItem('appointments');
    allAppointments = stored ? JSON.parse(stored) : [];
    filteredAppointments = [...allAppointments];
    updateStats();
    renderAppointments();
}

// ============================================
// RENDER APPOINTMENTS TABLE
// ============================================

function renderAppointments() {
    if (filteredAppointments.length === 0) {
        noAppointments.style.display = 'block';
        appointmentsTable.style.display = 'none';
        return;
    }

    noAppointments.style.display = 'none';
    appointmentsTable.style.display = 'block';

    tableBody.innerHTML = '';

    filteredAppointments.forEach(appointment => {
        const row = document.createElement('tr');
        
        const dateObj = new Date(appointment.date);
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        row.innerHTML = `
            <td class="col-patient">${escapeHtml(appointment.name)}</td>
            <td class="col-issue">${escapeHtml(appointment.issue)}</td>
            <td class="col-date">${formattedDate}</td>
            <td class="col-time">${appointment.time}</td>
            <td class="col-status">
                <span class="status-badge status-${appointment.status || 'confirmed'}">
                    ${(appointment.status || 'confirmed').toUpperCase()}
                </span>
            </td>
            <td class="col-actions">
                <div class="action-buttons">
                    <button class="btn-delete" onclick="openDeleteModal('${appointment.id}', '${appointment.name}', '${appointment.date}', '${appointment.time}')">Delete</button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// ============================================
// UPDATE STATS
// ============================================

function updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    let todayAppointments = 0;
    let upcomingAppointments = 0;

    allAppointments.forEach(appointment => {
        const appointmentDate = new Date(appointment.date);
        appointmentDate.setHours(0, 0, 0, 0);

        if (appointmentDate.getTime() === today.getTime()) {
            todayAppointments++;
        }

        if (appointmentDate >= today && appointmentDate <= sevenDaysFromNow) {
            upcomingAppointments++;
        }
    });

    totalCount.textContent = allAppointments.length;
    todayCount.textContent = todayAppointments;
    upcomingCount.textContent = upcomingAppointments;
}

// ============================================
// SEARCH AND FILTER
// ============================================

function filterAppointments() {
    const searchTerm = searchInput.value.toLowerCase();
    
    filteredAppointments = allAppointments.filter(appointment => {
        const name = appointment.name.toLowerCase();
        const issue = appointment.issue.toLowerCase();
        return name.includes(searchTerm) || issue.includes(searchTerm);
    });

    sortAppointments();
    renderAppointments();
}

function sortAppointments() {
    const sortValue = sortSelect.value;

    switch (sortValue) {
        case 'date-asc':
            filteredAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'date-desc':
            filteredAppointments.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'name-asc':
            filteredAppointments.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filteredAppointments.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }

    renderAppointments();
}

// ============================================
// DELETE APPOINTMENT
// ============================================

function openDeleteModal(id, name, date, time) {
    deleteConfirmId = id;
    document.getElementById('deletePatientName').textContent = name;
    document.getElementById('deletePatientInfo').textContent = `${date} at ${time}`;
    deleteModal.classList.add('show');
}

function closeDeleteModal() {
    deleteModal.classList.remove('show');
    deleteConfirmId = null;
}

function deleteAppointment() {
    allAppointments = allAppointments.filter(a => a.id != deleteConfirmId);
    localStorage.setItem('appointments', JSON.stringify(allAppointments));
    
    closeDeleteModal();
    loadAppointments();
    
    // Show success feedback
    showNotification('Appointment deleted successfully');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
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
// EXPORT FUNCTIONALITY
// ============================================

function exportAppointments() {
    if (allAppointments.length === 0) {
        showNotification('No appointments to export');
        return;
    }

    // Create CSV content
    let csvContent = 'Patient Name,Dental Issue,Date,Time,Status,Created At\n';
    
    allAppointments.forEach(appointment => {
        const createdAt = new Date(appointment.createdAt).toLocaleDateString('en-US');
        csvContent += `"${appointment.name}","${appointment.issue}","${appointment.date}","${appointment.time}","${appointment.status || 'confirmed'}","${createdAt}"\n`;
    });

    // Download CSV
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', `appointments_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showNotification('Appointments exported successfully');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// EVENT LISTENERS
// ============================================

searchInput.addEventListener('input', filterAppointments);
sortSelect.addEventListener('change', sortAppointments);
exportBtn.addEventListener('click', exportAppointments);
refreshBtn.addEventListener('click', () => {
    loadAppointments();
    showNotification('Appointments refreshed');
});

confirmDelete.addEventListener('click', deleteAppointment);
cancelDelete.addEventListener('click', closeDeleteModal);

// Close modal when clicking outside
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        closeDeleteModal();
    }
});

// ============================================
// AUTO-REFRESH (every 10 seconds)
// ============================================

setInterval(() => {
    loadAppointments();
}, 10000);

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadAppointments();

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
    `;
    document.head.appendChild(style);
});
