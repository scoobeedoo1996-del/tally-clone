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
    console.log("Jumping to ledger ID:", ledgerId);
    if (!ledgerId || ledgerId === 'undefined') {
        alert("Invalid Ledger ID");
        return;
    }

    // 1. Hide everything
    hideAllScreens();

    // 2. Try to show the screen - Check if ID matches exactly!
    const targetScreen = document.getElementById('ledger-statement-screen');
    if (!targetScreen) {
        console.error("Target screen 'ledger-statement-screen' not found in HTML!");
        showDashboard(); // Emergency fallback
        return;
    }
    targetScreen.classList.remove('hidden');

    // 3. Update filters (Using your specific IDs from previous code)
    const select = document.getElementById('stmt_ledger_select');
    const startInput = document.getElementById('stmt_start_date');
    const endInput = document.getElementById('stmt_end_date');

    if (select) select.value = ledgerId;
    if (startInput) startInput.value = currentCompany.books_beginning_from;
    if (endInput) endInput.valueAsDate = new Date();

    // 4. Run the report logic
    try {
        await loadLedgerStatement();
    } catch (err) {
        console.error("Failed to load statement:", err);
        targetScreen.innerHTML += `<p style="color:red">Error loading report: ${err.message}</p>`;
    }
}
async function openBalanceSheet() {
    // 1. Guard check
    if (!currentCompany) return;

    // 2. UI Transitions
    hideAllScreens();
    const screen = document.getElementById('balancesheet-screen');
    if (screen) screen.classList.remove('hidden');

    // 3. Set default date to today
    const dateInput = document.getElementById('bs_date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // 4. Run the calculation logic
    await loadBalanceSheet();
}
