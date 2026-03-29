// ui.js - Screen Transitions & UI Feedback
function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
}

function showMainScreen() {
    hideAllScreens();
    document.getElementById('main-screen').classList.remove('hidden');
}

function showDashboard() {
    hideAllScreens();
    document.getElementById('dashboard-screen').classList.remove('hidden');
}

function showLedgerScreen() {
    hideAllScreens();
    document.getElementById('ledger-screen').classList.remove('hidden');
}

function showVoucherScreen() {
    hideAllScreens();
    document.getElementById('voucher-screen').classList.remove('hidden');
}

function updateVoucherUI(type) {
    const header = document.getElementById('voucher-header');
    const title = document.getElementById('voucher-type-title');
    const label = document.getElementById('account-label');

    title.innerText = `${type} Voucher`;
    header.className = `tally-header header-nav bg-${type.toLowerCase()}`;

    // Tally-Specific Labels
    if (['Sales', 'CreditNote'].includes(type)) label.innerText = "Party A/c (Customer/Cash/Bank)";
    else if (['Purchase', 'DebitNote'].includes(type)) label.innerText = "Party A/c (Supplier/Cash/Bank)";
    else label.innerText = "Account (Cash/Bank)";
}
