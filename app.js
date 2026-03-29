// app.js - The Brain
let currentCompany = null;
let currentVoucherType = 'Payment';

document.addEventListener('DOMContentLoaded', () => {
    loadCompanies();
    document.getElementById('create-company-form').addEventListener('submit', handleCompanySubmit);
    document.getElementById('create-ledger-form').addEventListener('submit', handleLedgerSubmit);
    document.getElementById('voucher-form').addEventListener('submit', handleVoucherSubmit);
});

async function loadCompanies() {
    const list = document.getElementById('company-list');
    const { data, error } = await supabaseClient.from('companies').select('*').order('name');
    if (error) return;
    
    list.innerHTML = data.map(c => `
        <div class="company-card" onclick="selectCompany('${c.id}', '${c.name}')">
            <div class="company-info"><b>${c.name}</b></div>
            <div class="arrow">❯</div>
        </div>
    `).join('');
}

function selectCompany(id, name) {
    currentCompany = { id, name };
    document.getElementById('active-company-name').innerText = name;
    showDashboard();
}

async function openLedgers() {
    showLedgerScreen();
    const { data } = await supabaseClient.from('groups').select('id, name').order('name');
    document.getElementById('ledger_group').innerHTML = data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
}

async function openVoucherEntry() {
    showVoucherScreen();
    setVoucherType('Payment');
}

function setVoucherType(type, btn) {
    currentVoucherType = type;
    updateVoucherUI(type);
    loadVoucherLedgers(type);
    
    document.querySelectorAll('.v-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
}
