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

// --- Navigation "Back" Buttons (The missing pieces) ---

function exitCompany() {
    currentCompany = null; // Clear the active company
    showMainScreen();
}

function hideLedgerScreen() {
    showDashboard();
}

function hideVoucherScreen() {
    showDashboard();
}

// --- Visual Feedback ---

function updateVoucherUI(type) {
    const header = document.getElementById('voucher-header');
    const title = document.getElementById('voucher-type-title');
    const label = document.getElementById('account-label');

    title.innerText = `${type} Voucher`;
    
    // Safety check to ensure header exists
    if (header) {
        header.className = `tally-header header-nav bg-${type.toLowerCase()}`;
    }

    // Tally-Specific Labels for the "Top" account dropdown
    if (['Sales', 'CreditNote'].includes(type)) {
        label.innerText = "Party A/c (Customer/Cash/Bank)";
    } else if (['Purchase', 'DebitNote'].includes(type)) {
        label.innerText = "Party A/c (Supplier/Cash/Bank)";
    } else {
        label.innerText = "Account (Cash/Bank)";
    }
}
function showDayBookScreen() {
    hideAllScreens();
    document.getElementById('daybook-screen').classList.remove('hidden');
}

async function jumpToLedger(ledgerId) {
    if (!ledgerId || ledgerId === 'undefined') return;

    // 1. Switch to the Ledger Statement screen
    hideAllScreens();
    document.getElementById('ledger-statement-screen').classList.remove('hidden');

    // 2. Set the Dropdown to the clicked ledger
    const select = document.getElementById('stmt_ledger_select');
    select.value = ledgerId;

    // 3. Set the Dates (Default to full history from company start to today)
    document.getElementById('stmt_start_date').value = currentCompany.books_beginning_from;
    document.getElementById('stmt_end_date').valueAsDate = new Date();

    // 4. Run the report
    await loadLedgerStatement();
}
