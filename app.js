// app.js - The Brain
let currentCompany = null;
let currentVoucherType = 'Payment';

document.addEventListener('DOMContentLoaded', () => {
    loadCompanies();
    document.getElementById('create-ledger-form').addEventListener('submit', handleLedgerSubmit);
    document.getElementById('voucher-form').addEventListener('submit', handleVoucherSubmit);
});

async function loadCompanies() {
    const list = document.getElementById('company-list');
    const { data, error } = await supabaseClient.from('companies').select('*').order('name');
    if (error) return;
    
    // UPDATE: We are now passing the books_start date to the selectCompany function
    list.innerHTML = data.map(c => `
        <div class="company-card" onclick="selectCompany('${c.id}', '${c.name}', '${c.books_beginning_from}', '${c.financial_year_start}')">
            <div class="company-info"><b>${c.name}</b></div>
            <div class="arrow">❯</div>
        </div>
    `).join('');
}

// UPDATE: We now capture the dates and save them to the global currentCompany object
function selectCompany(id, name, booksStart, fyStart) {
    currentCompany = { 
        id: id, 
        name: name,
        books_beginning_from: booksStart,
        financial_year_start: fyStart
    };
    
    document.getElementById('active-company-name').innerText = name;
    
    // Bonus: Update the UI to show the actual financial year!
    document.getElementById('active-company-period').innerText = `Books from: ${booksStart}`;
    
    showDashboard();
}

async function openLedgers() {
    showLedgerScreen();
    const { data } = await supabaseClient.from('groups').select('id, name').order('name');
    document.getElementById('ledger_group').innerHTML = data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
}

async function openVoucherEntry() {
    showVoucherScreen();
    // Default to today's date
    document.getElementById('v_date').valueAsDate = new Date();
    // Call setVoucherType to initialize numbering and ledgers
    await setVoucherType('Payment');
}

async function setVoucherType(type, btn) {
    currentVoucherType = type;
    
    // 1. UI Updates (Header & Labels)
    updateVoucherUI(type);
    
    // 2. Dynamic Numbering (Tally Logic)
    const nextNo = await getNextVoucherNumber(type);
    document.getElementById('v_number').value = nextNo;
    
    // 3. Load Filtered Ledgers
    await loadVoucherLedgers(type);
    
    // 4. Button highlighting
    document.querySelectorAll('.v-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    else {
        // Find button by text if called programmatically
        const buttons = document.querySelectorAll('.v-btn');
        buttons.forEach(b => {
            if(b.innerText.includes(type.substring(0,4))) b.classList.add('active');
        });
    }
}
