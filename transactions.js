// transactions.js - Adaptive Voucher Logic
async function loadVoucherLedgers(type) {
    const mainSelect = document.getElementById('v_main_account');
    const partSelect = document.getElementById('v_particular_ledger');

    const { data: ledgers, error } = await supabaseClient
        .from('ledgers')
        .select('id, name, groups(name)')
        .eq('company_id', currentCompany.id);

    if (error) return;

    // --- TALLY FILTERING LOGIC ---
    let mainFilter = [];
    let partFilter = [];

    if (type === 'Sales' || type === 'CreditNote') {
        // Main: Customers (Debtors), Cash, or Bank
        mainFilter = ledgers.filter(l => ['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts'].includes(l.groups.name));
        // Particulars: Sales Accounts
        partFilter = ledgers.filter(l => l.groups.name === 'Sales Accounts');
    } 
    else if (type === 'Purchase' || type === 'DebitNote') {
        // Main: Suppliers (Creditors), Cash, or Bank
        mainFilter = ledgers.filter(l => ['Sundry Creditors', 'Cash-in-Hand', 'Bank Accounts'].includes(l.groups.name));
        // Particulars: Purchase Accounts
        partFilter = ledgers.filter(l => l.groups.name === 'Purchase Accounts');
    }
    else if (type === 'Contra') {
        mainFilter = ledgers.filter(l => ['Cash-in-Hand', 'Bank Accounts'].includes(l.groups.name));
        partFilter = mainFilter; 
    }
    else { // Payment or Receipt
        mainFilter = ledgers.filter(l => ['Cash-in-Hand', 'Bank Accounts'].includes(l.groups.name));
        partFilter = ledgers; // Can pay/receive against any ledger
    }

    // Populate Dropdowns
    mainSelect.innerHTML = '<option value="">Select Account</option>' + 
        mainFilter.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    
    partSelect.innerHTML = '<option value="">Select Particulars</option>' + 
        partFilter.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

async function handleVoucherSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('v-save-btn');
    
    const vDate = document.getElementById('v_date').value;
    const vMainLedger = document.getElementById('v_main_account').value;
    const vPartLedger = document.getElementById('v_particular_ledger').value;
    const vAmount = parseFloat(document.getElementById('v_amount').value);

    if (!vDate || !vMainLedger || !vPartLedger || isNaN(vAmount)) {
        return alert("Please fill all required fields correctly.");
    }

    btn.disabled = true;

    // 1. Insert Voucher Header (Using 'voucher_date' to match your DB)
    const { data: v, error: vErr } = await supabaseClient.from('vouchers').insert([{
        company_id: currentCompany.id,
        voucher_type: currentVoucherType,
        voucher_date: vDate, // Fixed: Matched to your screenshot
        voucher_number: document.getElementById('v_number').value,
        narration: document.getElementById('v_narration').value
    }]).select();

    if (vErr) {
        alert("Voucher Error: " + vErr.message);
        btn.disabled = false;
        return;
    }

    // 2. Insert Entries (Using 'is_debit' to match your DB)
    // Rule: if type is Receipt/Sales/Contra -> Main is Debit (true), Particular is Credit (false)
    let mainIsDebit = ['Receipt', 'Sales', 'Contra', 'DebitNote'].includes(currentVoucherType);
    
    const { error: eErr } = await supabaseClient.from('voucher_entries').insert([
        { 
            voucher_id: v[0].id, 
            ledger_id: vMainLedger, 
            amount: vAmount, 
            is_debit: mainIsDebit // Fixed: DB uses boolean 'is_debit'
        },
        { 
            voucher_id: v[0].id, 
            ledger_id: vPartLedger, 
            amount: vAmount, 
            is_debit: !mainIsDebit // The opposite of the main entry
        }
    ]);

    if (eErr) {
        alert("Entry Error: " + eErr.message);
    } else {
        alert("Voucher Saved Successfully!");
        showDashboard();
    }
    btn.disabled = false;
}
