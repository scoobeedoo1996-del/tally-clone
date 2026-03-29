async function getNextVoucherNumber(type) {
    if (!currentCompany) return 1;
    
    // DEBUG: See what we are actually asking the database
    console.log(`Asking DB for last voucher number of type: ${type}`);

    const { data, error } = await supabaseClient
        .from('vouchers')
        .select('voucher_number')
        .eq('company_id', currentCompany.id)
        .eq('voucher_type', type)
        .order('voucher_number', { ascending: false })
        .limit(1);

    // DEBUG: See what the database replies with
    if (error) {
        console.error("Database Error fetching number:", error);
        return 1;
    }
    console.log("Database returned this for last number:", data);

    // If no past vouchers exist for this type, start at 1
    if (!data || data.length === 0) return 1;
    
    // Otherwise, add 1 to the last number
    const lastNumber = parseInt(data[0].voucher_number);
    return isNaN(lastNumber) ? 1 : lastNumber + 1;
}
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
    else if (type === 'Journal') {
    // Journal allows any ledger for both sides
        mainFilter = ledgers; 
        partFilter = ledgers;
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
    const vNumber = parseInt(document.getElementById('v_number').value) || 1;
    
    if (!vDate || !vMainLedger || !vPartLedger || isNaN(vAmount)) {
        return alert("Please fill all required fields correctly.");
    }
    if (vMainLedger === vPartLedger) {
    return alert("Main Account and Particulars cannot be the same ledger.");
    }
    btn.disabled = true;

    // 1. Insert Voucher Header (Using 'voucher_date' to match your DB)
    const { data: v, error: vErr } = await supabaseClient.from('vouchers').insert([{
        company_id: currentCompany.id,
        voucher_type: currentVoucherType,
        voucher_date: vDate, // Fixed: Matched to your screenshot
        voucher_number: vNumber,
        narration: document.getElementById('v_narration').value
    }]).select();

    if (vErr) {
        alert("Voucher Error: " + vErr.message);
        btn.disabled = false;
        return;
    }

     // 2. Insert Entries (Using 'is_debit' to match your DB)
     // Rule: In Journal, Sales, Receipt, and Contra, we Debit the 'Main Account'
     // In Payment and Purchase, we Credit the 'Main Account'
    let mainIsDebit = ['Receipt', 'Sales', 'Contra', 'DebitNote','Journal'].includes(currentVoucherType);
    
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
