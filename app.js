// --- 1. Global State ---
let currentCompany = null;
let currentVoucherType = 'Payment';

// --- 2. Initialization (The "Brain" that connects everything) ---
document.addEventListener('DOMContentLoaded', () => {
    loadCompanies();
    
    // Connect Form Listeners
    setupListener('create-company-form', handleCompanySubmit);
    setupListener('create-ledger-form', handleLedgerSubmit);
    setupListener('voucher-form', handleVoucherSubmit);
});

// Helper to prevent errors if a form isn't on the current screen
function setupListener(id, handler) {
    const form = document.getElementById(id);
    if (form) form.addEventListener('submit', handler);
}

// --- 3. Screen Navigation ---
function showCreateScreen() {
    hideAllScreens();
    document.getElementById('create-screen').classList.remove('hidden');
    const year = new Date().getFullYear();
    document.getElementById('fy_start').value = `${year}-04-01`;
    document.getElementById('books_start').value = `${year}-04-01`;
}

function selectCompany(id, name) {
    currentCompany = { id, name };
    document.getElementById('active-company-name').innerText = name;
    hideAllScreens();
    document.getElementById('dashboard-screen').classList.remove('hidden');
}

function exitCompany() {
    currentCompany = null;
    hideAllScreens();
    document.getElementById('main-screen').classList.remove('hidden');
}

async function openLedgers() {
    hideAllScreens();
    document.getElementById('ledger-screen').classList.remove('hidden');
    await loadGroups();
}

async function openVoucherEntry() {
    hideAllScreens();
    document.getElementById('voucher-screen').classList.remove('hidden');
    document.getElementById('v_date').valueAsDate = new Date();
    await loadVoucherLedgers();
    setVoucherType('Payment'); // Initialize with Payment (F5)
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
}

function hideLedgerScreen() { selectCompany(currentCompany.id, currentCompany.name); }
function hideVoucherScreen() { selectCompany(currentCompany.id, currentCompany.name); }
function hideCreateScreen() { exitCompany(); }

// --- 4. Voucher Logic (F4 to F9) ---
function setVoucherType(type, btn) {
    currentVoucherType = type;
    const header = document.getElementById('voucher-header');
    const title = document.getElementById('voucher-type-title');
    const label = document.getElementById('account-label');
    
    // Update Button UI
    document.querySelectorAll('.v-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    else {
        // Fallback to highlight the first button if called programmatically
        const firstBtn = document.querySelector('.v-btn');
        if(firstBtn) firstBtn.classList.add('active');
    }
    
    title.innerText = `${type} Voucher`;
    
    // Tally Label Logic
    if(['Sales', 'CreditNote'].includes(type)) label.innerText = "Party A/c (Customer/Cash)";
    else if(['Purchase', 'DebitNote'].includes(type)) label.innerText = "Party A/c (Supplier/Cash)";
    else label.innerText = "Account (Cash/Bank)";

    // Update Color
    header.className = `tally-header header-nav bg-${type.toLowerCase()}`;
}

// --- 5. Data Fetching & Select Populating ---
async function loadCompanies() {
    const list = document.getElementById('company-list');
    list.innerHTML = '<p>Loading...</p>';
    const { data, error } = await supabaseClient.from('companies').select('*').order('name');
    if (error) return list.innerHTML = '<p>Error.</p>';
    
    list.innerHTML = data.map(c => `
        <div class="company-card" onclick="selectCompany('${c.id}', '${c.name}')">
            <div class="company-info"><b>${c.name}</b><span>FY: ${new Date(c.financial_year_start).getFullYear()}</span></div>
            <div class="arrow">❯</div>
        </div>
    `).join('');
}

async function loadGroups() {
    const select = document.getElementById('ledger_group');
    const { data } = await supabaseClient.from('groups').select('id, name').order('name');
    if (data) select.innerHTML = '<option value="">Select Group</option>' + data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
}

async function loadVoucherLedgers() {
    const mainAcc = document.getElementById('v_main_account');
    const partAcc = document.getElementById('v_particular_ledger');
    
    const { data, error } = await supabaseClient
        .from('ledgers')
        .select('id, name, groups(name)')
        .eq('company_id', currentCompany.id);

    if (error) return;

    // Filter top account for Cash/Bank if Contra/Payment/Receipt
    const cashBank = data.filter(l => l.groups.name.includes('Cash') || l.groups.name.includes('Bank'));
    
    mainAcc.innerHTML = '<option value="">Select Account</option>' + 
        (currentVoucherType === 'Contra' || currentVoucherType === 'Payment' || currentVoucherType === 'Receipt' ? cashBank : data)
        .map(l => `<option value="${l.id}">${l.name}</option>`).join('');

    partAcc.innerHTML = '<option value="">Select Particulars</option>' + 
        data.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

// --- 6. Final Submission Handlers ---
async function handleVoucherSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('v-save-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const { data: vRecord, error: vError } = await supabaseClient.from('vouchers').insert([{
        company_id: currentCompany.id,
        voucher_type: currentVoucherType,
        date: document.getElementById('v_date').value,
        voucher_number: document.getElementById('v_number').value,
        narration: document.getElementById('v_narration').value
    }]).select();

    if (vError) { alert(vError.message); btn.disabled = false; return; }

    // Debit/Credit Logic
    let mainType = ['Receipt', 'Sales', 'Contra', 'DebitNote'].includes(currentVoucherType) ? 'Debit' : 'Credit';
    let partType = mainType === 'Debit' ? 'Credit' : 'Debit';

    const { error: eError } = await supabaseClient.from('voucher_entries').insert([
        { voucher_id: vRecord[0].id, ledger_id: document.getElementById('v_main_account').value, amount: document.getElementById('v_amount').value, entry_type: mainType },
        { voucher_id: vRecord[0].id, ledger_id: document.getElementById('v_particular_ledger').value, amount: document.getElementById('v_amount').value, entry_type: partType }
    ]);

    if (!eError) { alert("Voucher Saved!"); hideVoucherScreen(); }
    btn.disabled = false;
    btn.innerText = "Accept";
}

async function handleLedgerSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('ledger-save-btn');
    btn.disabled = true;

    const ledgerData = {
        company_id: currentCompany.id,
        name: document.getElementById('ledger_name').value,
        group_id: document.getElementById('ledger_group').value,
        address: document.getElementById('ledger_address')?.value || '', // Added
        pan_no: document.getElementById('ledger_pan')?.value || '',     // Added
        opening_balance: document.getElementById('opening_bal').value,
        opening_balance_type: document.getElementById('bal_type').value
    };

    const { error } = await supabaseClient.from('ledgers').insert([ledgerData]);
    if (!error) { 
        alert("Ledger Created!"); 
        hideLedgerScreen(); 
    } else {
        alert("Error: " + error.message);
    }
    btn.disabled = false;
}

async function handleCompanySubmit(e) {
    e.preventDefault();
    const { error } = await supabaseClient.from('companies').insert([{
        name: document.getElementById('company_name').value,
        financial_year_start: document.getElementById('fy_start').value
    }]);
    if (!error) { hideCreateScreen(); loadCompanies(); }
}
