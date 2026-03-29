// reports.js - Day Book & Statement Logic

async function openDayBook() {
    showDayBookScreen();
    document.getElementById('daybook-date-filter').valueAsDate = new Date();
    await loadDayBook();
}

async function loadDayBook() {
    const list = document.getElementById('daybook-list');
    const selectedDate = document.getElementById('daybook-date-filter').value;
    
    list.innerHTML = '<p class="loading-text">Loading transactions...</p>';

    // Fetch vouchers and include their entries/ledgers
    const { data, error } = await supabaseClient
        .from('vouchers')
        .select(`
            id, voucher_type, voucher_number, date, narration,
            voucher_entries (
                amount, entry_type,
                ledgers ( name )
            )
        `)
        .eq('company_id', currentCompany.id)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = '<p>Error loading Day Book.</p>';
        return;
    }

    if (data.length === 0) {
        list.innerHTML = '<p class="empty-text">No transactions found for this date.</p>';
        return;
    }

    list.innerHTML = data.map(v => {
        // Find the main ledger (usually the first Debit entry in Tally view)
        const mainEntry = v.voucher_entries.find(e => e.entry_type === 'Debit') || v.voucher_entries[0];
        const colorClass = `text-${v.voucher_type.toLowerCase()}`;

        return `
            <div class="daybook-card">
                <div class="db-row">
                    <span class="db-ledger">${mainEntry.ledgers.name}</span>
                    <span class="db-type ${colorClass}">${v.voucher_type}</span>
                </div>
                <div class="db-row">
                    <span class="db-no">No. ${v.voucher_number}</span>
                    <span class="db-amount">₹ ${mainEntry.amount.toLocaleString('en-IN')}</span>
                </div>
                ${v.narration ? `<div class="db-narration">${v.narration}</div>` : ''}
            </div>
        `;
    }).join('');
}
