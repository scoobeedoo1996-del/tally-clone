async function loadCompanies() {
    const list = document.getElementById('company-list');
    list.innerHTML = '<p>Loading businesses...</p>';

    const { data, error } = await supabaseClient
        .from('companies')
        .select('*');

    if (error) {
        list.innerHTML = '<p>Connection Error.</p>';
        return;
    }

    if (data.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding: 20px;">No companies. Tap + to start.</p>';
        return;
    }

    list.innerHTML = data.map(company => `
        <div class="company-card">
            <div class="company-info">
                <b>${company.name}</b>
                <span>FY: ${company.financial_year_start}</span>
            </div>
            <div style="color: #CBD5E1;">❯</div>
        </div>
    `).join('');
}

window.onload = loadCompanies;
