// ===================================
// Configuration
// ===================================
const CONFIG = {
    // Google Apps Script Web App URL
    SHEET_API_URL: 'https://script.google.com/macros/s/AKfycbzWki9BWoq_z4P9MaZ5CxrfV3L4vw_MGxhUC8aztYBDm7GvgsDAzO9RtCTE3KwmnHE1/exec',
    // Set to false to use Google Sheets, true to use localStorage for testing
    USE_LOCAL_STORAGE: false
};

// ===================================
// State Management
// ===================================
let filmData = [];
let filteredData = [];
let currentEditId = null;
let sortColumn = 'id';
let sortDirection = 'asc';

// ===================================
// DOM Elements
// ===================================
const elements = {
    // Buttons
    addBtn: document.getElementById('addBtn'),
    closeModal: document.getElementById('closeModal'),
    cancelBtn: document.getElementById('cancelBtn'),
    closeConfirmModal: document.getElementById('closeConfirmModal'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

    // Forms
    dataForm: document.getElementById('dataForm'),

    // Inputs
    searchInput: document.getElementById('searchInput'),
    statusFilter: document.getElementById('statusFilter'),
    typeFilter: document.getElementById('typeFilter'),

    // Form Inputs
    editId: document.getElementById('editId'),
    titleInput: document.getElementById('titleInput'),
    typeInput: document.getElementById('typeInput'),
    episodesInput: document.getElementById('episodesInput'),
    statusInput: document.getElementById('statusInput'),
    dateInput: document.getElementById('dateInput'),
    notesInput: document.getElementById('notesInput'),

    // Display
    tableBody: document.getElementById('tableBody'),
    emptyState: document.getElementById('emptyState'),
    modal: document.getElementById('modal'),
    confirmModal: document.getElementById('confirmModal'),
    modalTitle: document.getElementById('modalTitle'),
    submitBtnText: document.getElementById('submitBtnText'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),

    // Stats
    totalCount: document.getElementById('totalCount'),
    completedCount: document.getElementById('completedCount'),
    watchingCount: document.getElementById('watchingCount'),
    plannedCount: document.getElementById('plannedCount')
};

// ===================================
// Data Mapping Functions
// ===================================
// Convert from Google Sheets format to application format
function mapFromSheetFormat(sheetData) {
    return sheetData.map(item => ({
        id: item.no,
        title: item.judul || '',
        type: item.type || '',
        episodes: item.episode || null,
        status: item.status || '',
        date: item.date || null,
        notes: item.notes || '',
        rowIndex: item.rowIndex // Keep for edit/delete operations
    }));
}

// Convert from application format to Google Sheets format
function mapToSheetFormat(appData) {
    return {
        judul: appData.title,
        type: appData.type,
        episode: appData.episodes,
        status: appData.status,
        date: appData.date,
        notes: appData.notes,
        rowIndex: appData.rowIndex // Include for edit operations
    };
}

// ===================================
// Initialization
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadData();
});

function initializeEventListeners() {
    // Button Events
    elements.addBtn.addEventListener('click', openAddModal);
    elements.closeModal.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.closeConfirmModal.addEventListener('click', closeConfirmModal);
    elements.cancelDeleteBtn.addEventListener('click', closeConfirmModal);
    elements.confirmDeleteBtn.addEventListener('click', confirmDelete);

    // Form Events
    elements.dataForm.addEventListener('submit', handleFormSubmit);

    // Search and Filter Events
    elements.searchInput.addEventListener('input', handleSearch);
    elements.statusFilter.addEventListener('change', handleFilter);
    elements.typeFilter.addEventListener('change', handleFilter);

    // Table Sort Events
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.sort));
    });

    // Modal Click Outside to Close
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    elements.confirmModal.addEventListener('click', (e) => {
        if (e.target === elements.confirmModal) closeConfirmModal();
    });
}

// ===================================
// Data Loading & API Functions
// ===================================
async function loadData() {
    showLoading('');

    try {
        if (CONFIG.USE_LOCAL_STORAGE) {
            // Load from localStorage
            const stored = localStorage.getItem('filmData');
            filmData = stored ? JSON.parse(stored) : getSampleData();
            if (!stored) {
                localStorage.setItem('filmData', JSON.stringify(filmData));
            }
        } else {
            // Load from Google Sheets
            const response = await fetch(`${CONFIG.SHEET_API_URL}?action=read`);
            const result = await response.json();

            if (result.status === 'success') {
                // Map from sheet format to application format
                filmData = mapFromSheetFormat(result.data);
            } else {
                throw new Error(result.message || 'Gagal memuat data');
            }
        }

        filteredData = [...filmData];
        renderTable();
        updateStats();
        hideLoading();

    } catch (error) {
        console.error('Error loading data:', error);
        hideLoading();
        showToast('Gagal memuat data: ' + error.message, 'error');

        // Fallback to sample data
        filmData = getSampleData();
        filteredData = [...filmData];
        renderTable();
        updateStats();
    }
}

async function saveData(data, action = 'add') {
    showLoading(action === 'add' ? 'Menambahkan data...' : 'Memperbarui data...');

    try {
        if (CONFIG.USE_LOCAL_STORAGE) {
            // Save to localStorage
            if (action === 'add') {
                const newId = filmData.length > 0 ? Math.max(...filmData.map(f => f.id)) + 1 : 1;
                data.id = newId;
                filmData.push(data);
            } else if (action === 'edit') {
                const index = filmData.findIndex(f => f.id === data.id);
                if (index !== -1) {
                    filmData[index] = data;
                }
            }
            localStorage.setItem('filmData', JSON.stringify(filmData));

        } else {
            // Save to Google Sheets
            const sheetData = mapToSheetFormat(data);
            const response = await fetch(CONFIG.SHEET_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    data: sheetData
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Reload data to get updated values from sheet
                await loadData();
                hideLoading();
                showToast(action === 'add' ? 'Data berhasil ditambahkan!' : 'Data berhasil diperbarui!', 'success');
                return; // Exit early since loadData already updates the UI
            } else {
                throw new Error(result.message || 'Gagal menyimpan data');
            }
        }

        filteredData = [...filmData];
        renderTable();
        updateStats();
        hideLoading();
        showToast(action === 'add' ? 'Data berhasil ditambahkan!' : 'Data berhasil diperbarui!', 'success');

    } catch (error) {
        console.error('Error saving data:', error);
        hideLoading();
        showToast('Gagal menyimpan data: ' + error.message, 'error');
        throw error;
    }
}

async function deleteData(id) {
    showLoading('Menghapus data...');

    try {
        if (CONFIG.USE_LOCAL_STORAGE) {
            // Delete from localStorage
            filmData = filmData.filter(f => f.id !== id);
            localStorage.setItem('filmData', JSON.stringify(filmData));

        } else {
            // Delete from Google Sheets
            const film = filmData.find(f => f.id === id);
            if (!film || !film.rowIndex) {
                throw new Error('Data tidak ditemukan');
            }

            const response = await fetch(CONFIG.SHEET_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'delete',
                    data: { rowIndex: film.rowIndex }
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Reload data to get updated row indices
                await loadData();
                hideLoading();
                showToast('Data berhasil dihapus!', 'success');
                return; // Exit early since loadData already updates the UI
            } else {
                throw new Error(result.message || 'Gagal menghapus data');
            }
        }

        filteredData = [...filmData];
        renderTable();
        updateStats();
        hideLoading();
        showToast('Data berhasil dihapus!', 'success');

    } catch (error) {
        console.error('Error deleting data:', error);
        hideLoading();
        showToast('Gagal menghapus data: ' + error.message, 'error');
    }
}

// ===================================
// UI Rendering
// ===================================
function renderTable() {
    elements.tableBody.innerHTML = '';

    if (filteredData.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');

    filteredData.forEach(film => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${film.id}</td>
            <td><strong>${escapeHtml(film.title)}</strong></td>
            <td>${escapeHtml(film.type)}</td>
            <td>${film.episodes || '-'}</td>
            <td><span class="status-badge ${getStatusClass(film.status)}">${escapeHtml(film.status)}</span></td>
            <td>${film.date ? formatDate(film.date) : '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editFilm(${film.id})">Edit</button>
                    <button class="action-btn delete-btn" onclick="openDeleteModal(${film.id})">Hapus</button>
                </div>
            </td>
        `;
        elements.tableBody.appendChild(row);
    });
}

function updateStats() {
    elements.totalCount.textContent = filmData.length;
    elements.completedCount.textContent = filmData.filter(f => f.status === 'Selesai').length;
    elements.watchingCount.textContent = filmData.filter(f => f.status === 'Sedang Ditonton').length;
    elements.plannedCount.textContent = filmData.filter(f => f.status === 'Rencana').length;
}

// ===================================
// Modal Functions
// ===================================
function openAddModal() {
    currentEditId = null;
    elements.modalTitle.textContent = 'Tambah Film/Donghua';
    elements.submitBtnText.textContent = 'Simpan';
    elements.dataForm.reset();
    elements.editId.value = '';

    // Auto-fill tanggal dengan tanggal saat ini
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    elements.dateInput.value = `${year}-${month}-${day}`;

    elements.modal.classList.remove('hidden');
}

function openEditModal(film) {
    currentEditId = film.id;
    elements.modalTitle.textContent = 'Edit Film/Donghua';
    elements.submitBtnText.textContent = 'Perbarui';

    elements.editId.value = film.id;
    elements.titleInput.value = film.title;
    elements.typeInput.value = film.type;
    elements.episodesInput.value = film.episodes || '';
    elements.statusInput.value = film.status;
    elements.dateInput.value = film.date || '';
    elements.notesInput.value = film.notes || '';

    elements.modal.classList.remove('hidden');
}

function closeModal() {
    elements.modal.classList.add('hidden');
    elements.dataForm.reset();
    currentEditId = null;
}

function openDeleteModal(id) {
    currentEditId = id;
    elements.confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    elements.confirmModal.classList.add('hidden');
    currentEditId = null;
}

// ===================================
// Event Handlers
// ===================================
async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        title: elements.titleInput.value.trim(),
        type: elements.typeInput.value,
        episodes: elements.episodesInput.value ? parseInt(elements.episodesInput.value) : null,
        status: elements.statusInput.value,
        date: elements.dateInput.value || null,
        notes: elements.notesInput.value.trim() || null
    };

    try {
        if (currentEditId) {
            formData.id = currentEditId;
            // Find the film to get its rowIndex
            const film = filmData.find(f => f.id === currentEditId);
            if (film && film.rowIndex) {
                formData.rowIndex = film.rowIndex;
            }
            await saveData(formData, 'edit');
        } else {
            await saveData(formData, 'add');
        }
        closeModal();
    } catch (error) {
        // Error already handled in saveData
    }
}

async function confirmDelete() {
    if (currentEditId) {
        await deleteData(currentEditId);
        closeConfirmModal();
    }
}

function handleSearch() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    applyFilters(searchTerm);
}

function handleFilter() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    applyFilters(searchTerm);
}

function applyFilters(searchTerm = '') {
    const statusFilter = elements.statusFilter.value;
    const typeFilter = elements.typeFilter.value;

    filteredData = filmData.filter(film => {
        const matchesSearch = !searchTerm ||
            film.title.toLowerCase().includes(searchTerm) ||
            film.type.toLowerCase().includes(searchTerm) ||
            film.status.toLowerCase().includes(searchTerm);

        const matchesStatus = !statusFilter || film.status === statusFilter;
        const matchesType = !typeFilter || film.type === typeFilter;

        return matchesSearch && matchesStatus && matchesType;
    });

    renderTable();
}

function handleSort(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }

    filteredData.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        // Handle null/undefined values
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Convert to lowercase for string comparison
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderTable();
}

// ===================================
// Global Functions (called from HTML)
// ===================================
window.editFilm = function (id) {
    const film = filmData.find(f => f.id === id);
    if (film) {
        openEditModal(film);
    }
};

window.openDeleteModal = openDeleteModal;

// ===================================
// UI Helper Functions
// ===================================
function showLoading(message = 'Memuat...') {
    elements.loadingOverlay.querySelector('.loading-text').textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// ===================================
// Utility Functions
// ===================================
function getStatusClass(status) {
    const statusMap = {
        'Selesai': 'status-selesai',
        'Sedang Ditonton': 'status-sedang-ditonton',
        'Rencana': 'status-rencana',
        'Ditunda': 'status-ditunda'
    };
    return statusMap[status] || '';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ===================================
// Sample Data
// ===================================
function getSampleData() {
    return [
        {
            id: 1,
            title: 'Soul Land',
            type: 'Donghua',
            episodes: 265,
            status: 'Sedang Ditonton',
            date: '2024-01-15',
            notes: 'Donghua adaptasi dari novel populer'
        },
        {
            id: 2,
            title: 'Battle Through The Heavens',
            type: 'Donghua',
            episodes: 52,
            status: 'Selesai',
            date: '2024-02-20',
            notes: 'Salah satu donghua terbaik'
        },
        {
            id: 3,
            title: 'The King\'s Avatar',
            type: 'Donghua',
            episodes: 12,
            status: 'Selesai',
            date: '2024-03-10',
            notes: 'Tentang pro gamer'
        },
        {
            id: 4,
            title: 'Mo Dao Zu Shi',
            type: 'Donghua',
            episodes: 23,
            status: 'Selesai',
            date: '2024-01-05',
            notes: 'Animasi dan cerita yang luar biasa'
        },
        {
            id: 5,
            title: 'Spirited Away',
            type: 'Film',
            episodes: 1,
            status: 'Selesai',
            date: '2024-02-14',
            notes: 'Masterpiece dari Studio Ghibli'
        },
        {
            id: 6,
            title: 'Perfect World',
            type: 'Donghua',
            episodes: 156,
            status: 'Sedang Ditonton',
            date: '2024-03-01',
            notes: 'Donghua dengan visual yang bagus'
        },
        {
            id: 7,
            title: 'Stellar Transformations',
            type: 'Donghua',
            episodes: 48,
            status: 'Rencana',
            date: null,
            notes: 'Masuk watchlist'
        },
        {
            id: 8,
            title: 'Swallowed Star',
            type: 'Donghua',
            episodes: 78,
            status: 'Ditunda',
            date: '2024-01-20',
            notes: 'Ditunda sementara'
        }
    ];
}
