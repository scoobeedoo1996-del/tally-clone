// Screen Navigation Variables
const mainScreen = document.getElementById('main-screen');
const createScreen = document.getElementById('create-screen');
const companyList = document.getElementById('company-list');

// ---- SCREEN NAVIGATION ----
function showCreateScreen() {
    mainScreen.classList.add('hidden');
    createScreen.classList.remove('hidden');
    
    // Auto-fill dates with current year to save time (Improvising on Tally!)
    const currentYear = new Date().getFullYear();
    document.getElementById('fy_start').value = `${currentYear}-04-01`; // Standard Indian FY start
    document.getElementById('books_start').value = `${currentYear}-04-01`;
}

function hideCreateScreen() {
    createScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    document.getElementById('create-company-form').reset();
}
let currentCompany = null;

// Function to select and enter a company
function selectCompany(companyId, companyName, period) {
    currentCompany = { id: companyId, name: companyName };
    
    // Update Dashboard UI
    document.getElementById('active-company-name').innerText = companyName;
    
    // Switch Screens
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
}

function exitCompany() {
    currentCompany = null;
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
}
// ---- FETCH COMPANIES ----
async function loadCompanies() {
    companyList.innerHTML = '<p>Loading businesses...</p>';

    const { data, error } = await supabaseClient
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false }); // Newest first

    if (error) {
        companyList.innerHTML = '<p>Connection Error.</p>';
        return;
    }

    if (data.length === 0) {
        companyList.innerHTML = '<p style="text-align:center; padding: 20px;">No companies. Tap + to start.</p>';
        return;
    }

    companyList.innerHTML = data.map(company => `
        <div class="company-card" onclick="selectCompany('${company.id}', '${company.name}')">
    <div class="company-info">
        <b>${company.name}</b>
        <span>FY: ${company.financial_year_start}</span>
    </div>
    <div style="color: #CBD5E1;">❯</div>
</div>
    `).join('');
}

// ---- SUBMIT FORM DATA TO SUPABASE ----
document.getElementById('create-company-form').addEventListener('submit', async function(e) {
    e.preventDefault(); // Prevent page reload
    const saveBtn = document.getElementById('save-btn');
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    // Gather data from form
    const newCompanyData = {
        name: document.getElementById('company_name').value,
        mailing_name: document.getElementById('mailing_name').value,
        address: document.getElementById('address').value,
        state: document.getElementById('state').value,
        country: document.getElementById('country').value,
        mobile: document.getElementById('mobile').value,
        email: document.getElementById('email').value,
        financial_year_start: document.getElementById('fy_start').value,
        books_beginning_from: document.getElementById('books_start').value
    };

    // Insert into Supabase
    const { error } = await supabaseClient.from('companies').insert([newCompanyData]);

    if (error) {
        alert("Error saving company: " + error.message);
        saveBtn.innerText = "Accept (Save)";
        saveBtn.disabled = false;
        return;
    }

    // Success! Return to main screen and refresh list
    hideCreateScreen();
    loadCompanies();
    
    saveBtn.innerText = "Accept (Save)";
    saveBtn.disabled = false;
});
// NAVIGATION FOR LEDGERS
async function openLedgers() {
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('ledger-screen').classList.remove('hidden');
    loadGroups(); // Load Tally groups into the dropdown
}

function hideLedgerScreen() {
    document.getElementById('ledger-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('create-ledger-form').reset();
}

// FETCH GROUPS FROM SUPABASE
async function loadGroups() {
    const groupSelect = document.getElementById('ledger_group');
    
    const { data, error } = await supabaseClient
        .from('groups')
        .select('id, name')
        .order('name', { ascending: true });

    if (!error) {
        groupSelect.innerHTML = '<option value="">Select a Group</option>' + 
            data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
}

// SAVE LEDGER TO SUPABASE
document.getElementById('create-ledger-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('ledger-save-btn');
    btn.innerText = "Saving...";
    
    const ledgerData = {
        company_id: currentCompany.id,
        name: document.getElementById('ledger_name').value,
        group_id: document.getElementById('ledger_group').value,
        opening_balance: parseFloat(document.getElementById('opening_bal').value) || 0,
        opening_balance_type: document.getElementById('bal_type').value
    };

    const { error } = await supabaseClient.from('ledgers').insert([ledgerData]);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Ledger Created Successfully!");
        hideLedgerScreen();
    }
    btn.innerText = "Accept";
});

// Initialize App
window.onload = loadCompanies;
