// reports.js - Handling Day Book and Financial Statements

async function openDayBook() {
    hideAllScreens();
    document.getElementById('daybook-screen').classList.remove('hidden');
    // Default to today's date
    document.getElementById('db_date_filter').valueAsDate = new Date();
    await loadDayBookData();
}

function hideDayBookScreen() {
    showDashboard();
}

async function loadDayBookData() {
    const listContainer = document.getElementById('daybook-list');
    const filterDate = document.getElementById('db_date_filter').value;
    
    listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Loading transactions...</p>';

    if (!currentCompany) return;

    // Fetch Vouchers AND their nested entries and ledger names in one query
    const { data, error } = await supabaseClient
        .from('vouchers')
        .select(`
            id, voucher_type, voucher_number, voucher_date, narration,
            voucher_entries ( amount, is_debit, ledgers ( name ) )
        `)
        .eq('company_id', currentCompany.id)
        .eq('voucher_date', filterDate)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Day Book Error:", error);
        listContainer.innerHTML = `<p style="color:red; text-align:center;">Failed to load data: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: #64748b;">No transactions found for this date.</p>';
        return;
    }

    // Generate HTML for each voucher
    let html = data.map(v => {
        // Tally Logic: Determine which ledger to display as the "Primary" name
        // For Receipts/Sales, the primary party is Credited (is_debit = false)
        // For Payments/Purchases, the primary party is Debited (is_debit = true)
        let displayEntry;
        if (['Receipt', 'Sales'].includes(v.voucher_type)) {
            displayEntry = v.voucher_entries.find(e => e.is_debit === false) || v.voucher_entries[0];
        } else {
            displayEntry = v.voucher_entries.find(e => e.is_debit === true) || v.voucher_entries[0];
        }

        const ledgerName = (displayEntry && displayEntry.ledgers) ? displayEntry.ledgers.name : 'Unknown Ledger';
        const amount = (displayEntry) ? displayEntry.amount : 0;
        const colorClass = `type-${v.voucher_type.toLowerCase()}`;

        return `
            <div class="db-card" style="border-left-color: var(--${v.voucher_type.toLowerCase()}-color, #64748b);">
                <div class="db-row db-header">
                    <span class="db-ledger">${ledgerName}</span>
                    <span class="db-amount">₹ ${parseFloat(amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div class="db-row db-sub">
                    <span class="db-type ${colorClass}">${v.voucher_type}</span>
                    <span class="db-vno">Vch No: ${v.voucher_number}</span>
                </div>
                ${v.narration ? `<div class="db-narration">Narration: ${v.narration}</div>` : ''}
            </div>
        `;
    }).join('');

    listContainer.innerHTML = html;
}
