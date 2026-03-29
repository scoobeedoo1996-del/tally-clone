// --- Global State ---
let currentCompany = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadCompanies();
    
    // Setup Form Listeners
    const ledgerForm = document.getElementById('create-ledger-form');
    if (ledgerForm) {
        ledgerForm.addEventListener('submit', handleLedgerSubmit);
    }
    
    const companyForm = document.getElementById('create-company-form');
    if (companyForm) {
        companyForm.addEventListener('submit', handleCompanySubmit);
    }
});

// --- Screen Navigation ---
function showCreateScreen() {
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('create-screen').classList.remove('hidden');
    // Default Tally Dates
    const year = new Date().getFullYear();
    document.getElementById('fy_start').value = `${year}-04-01`;
    document.getElementById('books_start').value = `${year}-04-01`;
}

function hideCreateScreen() {
    document.getElementById('create-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
}

function selectCompany(id, name) {
    currentCompany = { id, name };
    document.getElementById('active-company-name').innerText = name;
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
}

function exitCompany() {
    currentCompany = null;
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
}

async function openLedgers() {
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('ledger-screen').classList.remove('hidden');
    await loadGroups();
}

function hideLedgerScreen() {
    document.getElementById('ledger-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('create-ledger-form').reset();
}

// --- Data Fetching ---
async function loadCompanies() {
    const list = document.getElementById('company-list');
    list.innerHTML = '<p class="loading-text">Loading companies...</p>';

    const { data, error } = await supabaseClient
        .from('companies')
        .select('*')
        .order('name');

    if (error) {
        console.error(error);
        list.innerHTML = '<p>Error connecting to database.</p>';
        return;
    }

    list.innerHTML = data.map(c => `
        <div class="company-card" onclick="selectCompany('${c.id}', '${c.name}')">
            <div class="company-info">
                <b>${c.name}</b>
                <span>FY: ${new Date(c.financial_year_start).getFullYear()}</span>
            </div>
            <div class="arrow">❯</div>
        </div>
    `).join('');
}

async function loadGroups() {
    const select = document.getElementById('ledger_group');
    const { data, error } = await supabaseClient.from('groups').select('id, name').order('name');
    
    if (!error) {
        select.innerHTML = '<option value="">Select a Group</option>' + 
            data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
}

// --- Form Handlers (Production Ready) ---
async function handleLedgerSubmit(e) {
    e.preventDefault();
    if (!currentCompany) return alert("No active company selected!");

    const btn = document.getElementById('ledger-save-btn');
    btn.innerText = "Processing...";
    btn.disabled = true; // Prevent double submit

    const ledgerData = {
        company_id: currentCompany.id,
        name: document.getElementById('ledger_name').value,
        group_id: document.getElementById('ledger_group').value,
        opening_balance: parseFloat(document.getElementById('opening_bal').value) || 0,
        opening_balance_type: document.getElementById('bal_type').value
    };

    const { error } = await supabaseClient.from('ledgers').insert([ledgerData]);

    if (error) {
        alert("Upload Failed: " + error.message);
    } else {
        alert("Ledger successfully added to " + currentCompany.name);
        hideLedgerScreen();
    }
    
    btn.innerText = "Accept";
    btn.disabled = false;
}

async function handleCompanySubmit(e) {
    e.preventDefault();
    const btn = document.querySelector('#create-company-form .submit-btn');
    btn.innerText = "Creating...";
    btn.disabled = true;

    const companyData = {
        name: document.getElementById('company_name').value,
        financial_year_start: document.getElementById('fy_start').value,
        mailing_name: document.getElementById('mailing_name').value || document.getElementById('company_name').value
    };

    const { error } = await supabaseClient.from('companies').insert([companyData]);

    if (error) {
        alert("Error: " + error.message);
    } else {
        hideCreateScreen();
        await loadCompanies();
    }
    
    btn.innerText = "Accept (Save)";
    btn.disabled = false;
}
let currentVoucherType = 'Payment';

function setVoucherType(type, btn) {
    currentVoucherType = type;
    const header = document.getElementById('voucher-header');
    const title = document.getElementById('voucher-type-title');
    const label = document.getElementById('account-label');
    
    document.querySelectorAll('.v-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    title.innerText = `${type} Voucher`;
    
    // UI Label logic
    if(type === 'Sales' || type === 'CreditNote') label.innerText = "Party A/c (Customer/Cash)";
    else if(type === 'Purchase' || type === 'DebitNote') label.innerText = "Party A/c (Supplier/Cash)";
    else label.innerText = "Account (Cash/Bank)";

    header.className = `tally-header header-nav bg-${type.toLowerCase()}`;
}

async function handleVoucherSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('v-save-btn');
    btn.disabled = true;
    btn.innerText = "Posting...";

    const mainAccId = document.getElementById('v_main_account').value;
    const partAccId = document.getElementById('v_particular_ledger').value;
    const amount = parseFloat(document.getElementById('v_amount').value);

    // 1. Insert Voucher Header
    const { data: vRecord, error: vError } = await supabaseClient
        .from('vouchers')
        .insert([{
            company_id: currentCompany.id,
            voucher_type: currentVoucherType,
            date: document.getElementById('v_date').value,
            voucher_number: document.getElementById('v_number').value,
            narration: document.getElementById('v_narration').value
        }]).select();

    if (vError) {
        alert(vError.message);
        btn.disabled = false;
        return;
    }

    const vId = vRecord[0].id;

    // 2. Accounting Logic: Who is Dr and Who is Cr?
    let mainEntryType = 'Credit'; // Default for Payment/Purchase/DebitNote
    let partEntryType = 'Debit';

    if (['Receipt', 'Sales', 'Contra', 'DebitNote'].includes(currentVoucherType)) {
        // In these cases, the "Top" account is usually the one receiving value (Debit)
        mainEntryType = 'Debit';
        partEntryType = 'Credit';
    } 
    
    // Refined override for Purchase/Payment
    if (['Payment', 'Purchase', 'CreditNote'].includes(currentVoucherType)) {
        mainEntryType = 'Credit';
        partEntryType = 'Debit';
    }

    const entries = [
        { voucher_id: vId, ledger_id: mainAccId, amount: amount, entry_type: mainEntryType },
        { voucher_id: vId, ledger_id: partAccId, amount: amount, entry_type: partEntryType }
    ];

    const { error: eError } = await supabaseClient.from('voucher_entries').insert(entries);

    if (eError) {
        alert("Accounting Error: " + eError.message);
    } else {
        alert(`${currentVoucherType} Posted Successfully!`);
        hideVoucherScreen();
    }
    btn.disabled = false;
    btn.innerText = "Accept";
}
