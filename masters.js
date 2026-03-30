// masters.js - Company & Ledger Logic
async function handleLedgerSubmit(e) {
    e.preventDefault();
    if (!currentCompany) return;

    const data = {
        company_id: currentCompany.id,
        name: document.getElementById('ledger_name').value,
        group_id: document.getElementById('ledger_group').value,
        address: document.getElementById('ledger_address').value,
        pan_no: document.getElementById('ledger_pan').value,
        opening_balance: parseFloat(document.getElementById('opening_bal').value) || 0,
        opening_balance_type: document.getElementById('bal_type').value
    };

    const { error } = await supabaseClient.from('ledgers').insert([data]);
    if (!error) { alert("Ledger Created"); showDashboard(); }
    else { alert(error.message); }
}
