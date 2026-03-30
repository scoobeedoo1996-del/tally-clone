// reports.js - Handling Day Book and Financial Statements

async function openDayBook() {
    // STRUCTURAL CHECK
    if (!currentCompany) return showScreen('company-selection-screen');

    hideAllScreens();
    document.getElementById('daybook-screen').classList.remove('hidden');
    
    // Default to today's date
    const dateInput = document.getElementById('db_date_filter');
    if(dateInput) dateInput.valueAsDate = new Date();
    
    await loadDayBookData();
}
function hideDayBookScreen() {
    showDashboard();
}

async function loadDayBookData() {
    // STRUCTURAL CHECK
    if (!currentCompany) return;

    const listContainer = document.getElementById('daybook-list');
    const filterDate = document.getElementById('db_date_filter').value;
    
    listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Loading transactions...</p>';

    const { data, error } = await supabaseClient
        .from('vouchers')
        .select(`
            id, voucher_type, voucher_number, voucher_date, narration,
            voucher_entries ( ledger_id,amount, is_debit, ledgers ( name ) )
        `)
        .eq('company_id', currentCompany.id)
        .eq('voucher_date', filterDate)
        .order('voucher_number', { ascending: true }); // Better for Day Book than created_at

    if (error) {
        listContainer.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: #64748b;">No transactions for this date.</p>';
        return;
    }

    let html = data.map(v => {
        // Standardize naming: Journal/Payment/Purchase/DebitNote = Debit is primary
        // Sales/Receipt/Contra/CreditNote = Credit is primary (usually)
        let displayEntry;
        const debitPrimaryTypes = ['Payment', 'Purchase', 'DebitNote', 'Journal'];
        
        if (debitPrimaryTypes.includes(v.voucher_type)) {
            displayEntry = v.voucher_entries.find(e => e.is_debit === true);
        } else {
            displayEntry = v.voucher_entries.find(e => e.is_debit === false);
        }

        const ledgerName = displayEntry?.ledgers?.name || 'Multiple Ledgers';
        const amount = displayEntry?.amount || v.voucher_entries[0]?.amount || 0;
        const ledgerId = displayEntry?.ledger_id;
        return `
            <div class="db-card" style="border-left: 4px solid var(--${v.voucher_type.toLowerCase()}-color, #64748b);">
                <div class="db-row db-header">
                   <span class="db-ledger" onclick="jumpToLedger('${ledgerId}')" style="cursor:pointer; color:#2563eb;">
                   <b>${ledgerName}</b>
                   </span>
                    <span class="db-amount">₹ ${parseFloat(amount).toFixed(2)}</span>
                </div>
                <div class="db-row db-sub">
                    <span class="db-type">${v.voucher_type}</span>
                    <span class="db-vno">No: ${v.voucher_number}</span>
                </div>
                ${v.narration ? `<div class="db-narration">${v.narration}</div>` : ''}
            </div>
        `;
    }).join('');

    listContainer.innerHTML = html;
}
// --- LEDGER STATEMENT LOGIC ---

async function openLedgerStatement() {
    hideAllScreens();
    document.getElementById('statement-screen').classList.remove('hidden');
    document.getElementById('stmt_start_date').valueAsDate = new Date();
    document.getElementById('stmt_end_date').valueAsDate = new Date();
    // Load all ledgers into the dropdown
    const { data: ledgers } = await supabaseClient
        .from('ledgers')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .order('name');
        
    const select = document.getElementById('stmt_ledger_select');
    select.innerHTML = '<option value="">-- Select Ledger --</option>' + 
        ledgers.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        
    document.getElementById('statement-body').innerHTML = '';
    document.getElementById('statement-footer').innerHTML = '';
}

// Helper to set dates quickly (Like Tally shortcuts)
function setTallyPeriod(type) {
    const startInput = document.getElementById('stmt_start_date');
    const endInput = document.getElementById('stmt_end_date');
    const now = new Date();

    if (type === 'today') {
        startInput.valueAsDate = now;
        endInput.valueAsDate = now;
    } else if (type === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        startInput.valueAsDate = firstDay;
        endInput.valueAsDate = now;
    }
    loadLedgerStatement();
}

async function loadLedgerStatement() {
    const ledgerId = document.getElementById('stmt_ledger_select').value;
    const startDate = document.getElementById('stmt_start_date').value;
    const endDate = document.getElementById('stmt_end_date').value;
    if (!ledgerId || !startDate || !endDate) return;

    // 1. Fetch Ledger Master Data
    const { data: ledger } = await supabaseClient
        .from('ledgers')
        .select('opening_balance, opening_balance_type')
        .eq('id', ledgerId).single();

    // 2. Fetch ALL entries for this ledger BEFORE the startDate
    const { data: prevEntries } = await supabaseClient
        .from('voucher_entries')
        .select('amount, is_debit, vouchers!inner(voucher_date)')
        .eq('ledger_id', ledgerId)
        .lt('vouchers.voucher_date', startDate);

    // Calculate "Period Opening Balance"
    let runningBal = parseFloat(ledger.opening_balance) || 0;
    let isRunningDr = ledger.opening_balance_type === 'Dr';

    prevEntries.forEach(e => {
        if (e.is_debit === isRunningDr) {
            runningBal += parseFloat(e.amount);
        } else {
            runningBal -= parseFloat(e.amount);
            if (runningBal < 0) {
                runningBal = Math.abs(runningBal);
                isRunningDr = !isRunningDr;
            }
        }
    });

    const periodOpening = { amount: runningBal, type: isRunningDr ? 'Dr' : 'Cr' };

    // 3. Fetch entries WITHIN the period (Your existing logic)
    const { data: currentEntries } = await supabaseClient
        .from('voucher_entries')
        .select(`
            amount, is_debit,
            vouchers!inner ( id, voucher_date, voucher_type, voucher_number, narration )
        `)
        .eq('ledger_id', ledgerId)
        .gte('vouchers.voucher_date', startDate)
        .lte('vouchers.voucher_date', endDate)
        .order('vouchers(voucher_date)', { ascending: true });

    // Fetch related ledger names for "Particulars"
    const vIds = currentEntries.map(e => e.vouchers.id);
    const { data: relatives } = await supabaseClient
        .from('voucher_entries')
        .select('voucher_id, ledgers(name)')
        .in('voucher_id', vIds)
        .neq('ledger_id', ledgerId);

    const formattedVouchers = currentEntries.map(e => {
        const other = relatives.find(r => r.voucher_id === e.vouchers.id);
        return {
            ...e.vouchers,
            myEntry: { is_debit: e.is_debit, amount: e.amount },
            particulars: other ? other.ledgers.name : 'Unknown'
        };
    });

    renderTallyStyleTable(periodOpening, formattedVouchers);
}
function renderTallyStyleTable(opening, vouchers) {
    const tbody = document.getElementById('statement-body');
    const tfoot = document.getElementById('statement-footer');
    
    let curDebit = 0;
    let curCredit = 0;

// Ensure we have safe, fallback numbers even if database returns null
    const safeOpeningAmt = opening && !isNaN(opening.amount) ? parseFloat(opening.amount) : 0;
    const safeOpeningType = (opening && opening.type) ? opening.type : 'Dr';

    // Opening Balance Row
    let html = `
        <tr class="balance-row" style="background: #fffdf0;">
            <td>${document.getElementById('stmt_start_date').value}</td>
            <td colspan="3"><b>Opening Balance</b></td>
            <td class="text-right">${safeOpeningType === 'Dr' ? safeOpeningAmt.toFixed(2) : ''}</td>
            <td class="text-right">${safeOpeningType === 'Cr' ? safeOpeningAmt.toFixed(2) : ''}</td>
        </tr>
    `;

    // Transaction Rows
    vouchers.forEach(v => {
        const dr = v.myEntry.is_debit ? v.myEntry.amount : 0;
        const cr = !v.myEntry.is_debit ? v.myEntry.amount : 0;
        curDebit += dr;
        curCredit += cr;

        html += `
            <tr>
                <td>${v.voucher_date}</td>
                <td>${v.myEntry.is_debit ? 'To' : 'By'} <b>${v.particulars}</b></td>
                <td>${v.voucher_type}</td>
                <td>${v.voucher_number}</td>
                <td class="text-right">${dr > 0 ? dr.toFixed(2) : ''}</td>
                <td class="text-right">${cr > 0 ? cr.toFixed(2) : ''}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    // Footer Calculation
    const totalDr = (opening.type === 'Dr' ? opening.amount : 0) + curDebit;
    const totalCr = (opening.type === 'Cr' ? opening.amount : 0) + curCredit;
    const closingAmt = Math.abs(totalDr - totalCr);
    const closingType = totalDr > totalCr ? 'Dr' : 'Cr';

    tfoot.innerHTML = `
        <tr class="total-row">
            <th colspan="4" class="text-right">Current Total:</th>
            <th class="text-right">${curDebit.toFixed(2)}</th>
            <th class="text-right">${curCredit.toFixed(2)}</th>
        </tr>
        <tr class="balance-row">
            <th colspan="4" class="text-right">Closing Balance (${closingType}):</th>
            <th class="text-right">${closingType === 'Dr' ? closingAmt.toFixed(2) : ''}</th>
            <th class="text-right">${closingType === 'Cr' ? closingAmt.toFixed(2) : ''}</th>
        </tr>
    `;
}
async function openTrialBalance() {
    // STRUCTURAL CHECK
    if (!currentCompany) return showScreen('company-selection-screen');

    hideAllScreens();
    document.getElementById('trialbalance-screen').classList.remove('hidden');
    
    // Set to Today's Date
    document.getElementById('tb_date').valueAsDate = new Date();
    await loadTrialBalance();
}

async function loadTrialBalance() {
    // STRUCTURAL CHECK
    if (!currentCompany) return;

    const asOnDate = document.getElementById('tb_date').value;
    const tbody = document.getElementById('tb-body');
    const tfoot = document.getElementById('tb-footer');
    
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Calculating...</td></tr>';

    // 1. Fetch Ledgers
    const { data: ledgers } = await supabaseClient
        .from('ledgers')
        .select('id, name, opening_balance, opening_balance_type')
        .eq('company_id', currentCompany.id);

    // 2. Fetch ALL entries from books_beginning_from up to asOnDate
    const { data: entries } = await supabaseClient
        .from('voucher_entries')
        .select('ledger_id, amount, is_debit, vouchers!inner(voucher_date)')
        .eq('vouchers.company_id', currentCompany.id)
        .gte('vouchers.voucher_date', currentCompany.books_beginning_from) // START
        .lte('vouchers.voucher_date', asOnDate); // END

    // 3. Calculate Closing Balance for each Ledger
    const ledgerBalances = ledgers.map(l => {
        let bal = parseFloat(l.opening_balance) || 0;
        let isDr = l.opening_balance_type === 'Dr';

        const myEntries = entries.filter(e => e.ledger_id === l.id);
        myEntries.forEach(e => {
            const amt = parseFloat(e.amount);
            if (e.is_debit === isDr) {
                bal += amt;
            } else {
                bal -= amt;
                if (bal < 0) {
                    bal = Math.abs(bal);
                    isDr = !isDr;
                }
            }
        });
        return { name: l.name, amount: bal, type: isDr ? 'Dr' : 'Cr' };
    });

    // 4. Render Rows
    let totalDr = 0;
    let totalCr = 0;
    let html = '';

    ledgerBalances.forEach(lb => {
        if (lb.amount === 0) return; // Skip zero balances
        
        const dr = lb.type === 'Dr' ? lb.amount : 0;
        const cr = lb.type === 'Cr' ? lb.amount : 0;
        totalDr += dr;
        totalCr += cr;

        html += `
            <tr>
                <td>${lb.name}</td>
                <td class="text-right">${dr > 0 ? dr.toFixed(2) : ''}</td>
                <td class="text-right">${cr > 0 ? cr.toFixed(2) : ''}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // 5. Footer - The "Difference" Check
    const difference = Math.abs(totalDr - totalCr);
    
    tfoot.innerHTML = `
        <tr class="total-row" style="background: #e2e8f0; font-weight: bold;">
            <td>Grand Total</td>
            <td class="text-right">${totalDr.toFixed(2)}</td>
            <td class="text-right">${totalCr.toFixed(2)}</td>
        </tr>
        ${difference > 0.01 ? `
        <tr style="color: red; background: #fee2e2;">
            <td><b>Difference in Opening Balances:</b></td>
            <td colspan="2" class="text-right"><b>${difference.toFixed(2)}</b></td>
        </tr>` : ''}
    `;
}
async function openPL() {
    hideAllScreens();
    document.getElementById('pl-screen').classList.remove('hidden');

    // 1. Get the current date for the end date
    const now = new Date();
    document.getElementById('pl_end_date').valueAsDate = now;

    // 2. Use the company's "Books Beginning From" date as the start date
    // We check if currentCompany exists and has the property; otherwise, fallback to April 1st.
    if (currentCompany && currentCompany.books_beginning_from) {
        document.getElementById('pl_start_date').value = currentCompany.books_beginning_from;
    } else {
        // Fallback if company data isn't loaded for some reason
        document.getElementById('pl_start_date').value = now.getFullYear() + "-04-01";
    }

    // 3. Load the report automatically with these dates
    await loadPLStatement();
}

async function loadPLStatement() {
    const start = document.getElementById('pl_start_date').value;
    const end = document.getElementById('pl_end_date').value;
    const container = document.getElementById('pl-content');

    if (!start || !end) return;
    container.innerHTML = "<div style='padding: 20px;'>Calculating Profit & Loss...</div>";

    // 1. Fetch Ledgers (Removed 'nature' to avoid database errors if column is missing)
    const { data: ledgers, error: ledgersErr } = await supabaseClient
        .from('ledgers')
        .select('id, name, groups(name)')
        .eq('company_id', currentCompany?.id || currentCompany);

    if (ledgersErr) {
        console.error("P&L Ledger Fetch Error:", ledgersErr);
        container.innerHTML = `<div style="color:red; padding:20px;">Error fetching ledgers. Check console.</div>`;
        return;
    }

    // 2. Fetch Entries
    const { data: entries, error: entriesErr } = await supabaseClient
        .from('voucher_entries')
        .select('ledger_id, amount, is_debit, vouchers!inner(voucher_date)')
        .gte('vouchers.voucher_date', start)
        .lte('vouchers.voucher_date', end);

    if (entriesErr) {
        console.error("P&L Entries Fetch Error:", entriesErr);
        return;
    }

    // 3. Setup Categories
    const categories = {
        directIncome: { label: "Sales & Direct Incomes", total: 0, items: [] },
        directExpense: { label: "Purchases & Direct Expenses", total: 0, items: [] },
        indirectIncome: { label: "Indirect Incomes", total: 0, items: [] },
        indirectExpense: { label: "Indirect Expenses", total: 0, items: [] }
    };

    // 4. Calculate logic with flexible group names
    ledgers.forEach(l => {
        const groupName = l.groups?.name || '';
        
        // Find all entries for this specific ledger
        const myEntries = entries.filter(e => e.ledger_id === l.id);
        if (myEntries.length === 0) return; // Skip if no transactions

        let bal = 0;
        let isIncome = false;

        // Categorize based on Group Name (Tolerates singular/plural)
        let targetCategory = null;
        if (groupName.includes('Sales') || groupName.includes('Direct Income')) {
            targetCategory = categories.directIncome;
            isIncome = true;
        } else if (groupName.includes('Purchase') || groupName.includes('Direct Expense')) {
            targetCategory = categories.directExpense;
        } else if (groupName.includes('Indirect Income')) {
            targetCategory = categories.indirectIncome;
            isIncome = true;
        } else if (groupName.includes('Indirect Expense')) {
            targetCategory = categories.indirectExpense;
        }

        if (!targetCategory) return; // Skip Assets/Liabilities, they belong in Balance Sheet!

        // Do the math based on Income vs Expense
        myEntries.forEach(e => {
            const amt = parseFloat(e.amount) || 0;
            if (isIncome) {
                // For Sales/Incomes: Credits add up, Debits reduce
                bal += e.is_debit ? -amt : amt;
            } else {
                // For Purchases/Expenses: Debits add up, Credits reduce
                bal += e.is_debit ? amt : -amt;
            }
        });

        if (bal !== 0) {
            targetCategory.items.push({ name: l.name, bal });
            targetCategory.total += bal;
        }
    });

    // 5. Final Calculations & Rendering
    const grossProfit = categories.directIncome.total - categories.directExpense.total;
    const netProfit = (grossProfit + categories.indirectIncome.total) - categories.indirectExpense.total;

    container.innerHTML = `
        ${renderPLGroup(categories.directIncome)}
        ${renderPLGroup(categories.directExpense)}
        <div class="pl-row pl-total-row">
            <span>GROSS PROFIT</span>
            <span class="${grossProfit >= 0 ? 'text-profit' : 'text-loss'}">₹ ${Math.abs(grossProfit).toFixed(2)}</span>
        </div>
        ${renderPLGroup(categories.indirectIncome)}
        ${renderPLGroup(categories.indirectExpense)}
        <div class="pl-row pl-total-row" style="background: #1e293b; color: white;">
            <span>NET PROFIT</span>
            <span style="color: ${netProfit >= 0 ? '#4ade80' : '#f87171'}">₹ ${Math.abs(netProfit).toFixed(2)}</span>
        </div>
    `;
}

function renderPLGroup(group) {
    if (group.items.length === 0) return '';
    let html = `<div class="pl-row pl-group-head"><span>${group.label}</span><span></span></div>`;
    group.items.forEach(i => {
        html += `<div class="pl-row pl-ledger-row"><span>${i.name}</span><span>${Math.abs(i.bal).toFixed(2)}</span></div>`;
    });
    return html;
}
async function loadBalanceSheet() {
    const asOnDate = document.getElementById('bs_date').value;
    const container = document.getElementById('bs-content');

    if (!currentCompany || !asOnDate) return;
    container.innerHTML = "Calculating Balance Sheet...";

    // 1. Fetch Ledgers and Entries (Similar to Trial Balance)
    const { data: ledgers } = await supabaseClient
        .from('ledgers')
        .select('id, name, opening_balance, opening_balance_type, groups(name, nature)')
        .eq('company_id', currentCompany.id);

    const { data: entries } = await supabaseClient
        .from('voucher_entries')
        .select('ledger_id, amount, is_debit, vouchers!inner(voucher_date)')
        .eq('vouchers.company_id', currentCompany.id)
        .lte('vouchers.voucher_date', asOnDate);

    // 2. Categories
    const bs = {
        liabilities: { label: "Liabilities", items: [], total: 0 },
        assets: { label: "Assets", items: [], total: 0 }
    };

    ledgers.forEach(l => {
        // Only include Assets and Liabilities (Ignore Income/Expense)
        if (l.groups.nature !== 'Asset' && l.groups.nature !== 'Liability') return;

        let bal = parseFloat(l.opening_balance) || 0;
        let isDr = l.opening_balance_type === 'Dr';

        const myEntries = entries.filter(e => e.ledger_id === l.id);
        myEntries.forEach(e => {
            const amt = parseFloat(e.amount);
            if (e.is_debit === isDr) bal += amt;
            else {
                bal -= amt;
                if (bal < 0) { bal = Math.abs(bal); isDr = !isDr; }
            }
        });

        if (bal !== 0) {
            const item = { name: l.name, amount: bal };
            if (l.groups.nature === 'Liability') {
                bs.liabilities.items.push(item);
                bs.liabilities.total += (isDr ? -bal : bal); // Cr is positive for Liability
            } else {
                bs.assets.items.push(item);
                bs.assets.total += (isDr ? bal : -bal); // Dr is positive for Asset
            }
        }
    });

    // 3. Render Table
    container.innerHTML = `
        <div class="bs-grid">
            <div class="bs-col">${renderBSSide(bs.liabilities)}</div>
            <div class="bs-col">${renderBSSide(bs.assets)}</div>
        </div>
        <div class="bs-footer">
            <span>Difference: ${(bs.assets.total - bs.liabilities.total).toFixed(2)}</span>
        </div>
    `;
}

function renderBSSide(side) {
    let html = `<h3>${side.label} <span class="pull-right">${side.total.toFixed(2)}</span></h3>`;
    side.items.forEach(i => {
        html += `<div class="bs-row"><span>${i.name}</span><span>${i.amount.toFixed(2)}</span></div>`;
    });
    return html;
}
