document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'ceo') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userNameHeader').textContent = user.name || user.username;

    loadCoordinators();
    loadUnitsForCheckboxes();

    // Modal logic
    const modal = document.getElementById('entryModal');
    const btn = document.getElementById('openModal');
    const span = document.getElementById('closeModal');

    btn.onclick = () => {
        modal.classList.add('active');
        loadUnitsForCheckboxes(); // Refresh units when opening
    };
    span.onclick = () => modal.classList.remove('active');
    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('active');
    };

    // Form logic
    const form = document.getElementById('coordinatorForm');
    form.onsubmit = async (e) => {
        e.preventDefault();

        const selectedUnits = Array.from(document.querySelectorAll('#unitsCheckboxList input[type="checkbox"]:checked'))
            .map(cb => parseInt(cb.value));

        const data = {
            name: document.getElementById('nameInput').value,
            email: document.getElementById('emailInput').value,
            password: document.getElementById('passwordInput').value,
            unitIds: selectedUnits
        };

        try {
            const response = await fetch('/api/coordinators', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Coordenador cadastrado com sucesso!');
                modal.classList.remove('active');
                form.reset();
                loadCoordinators();
            } else {
                const error = await response.json();
                alert('Erro ao cadastrar coordenador: ' + (error.error || 'Erro desconhecido'));
            }
        } catch (err) {
            console.error(err);
            alert('Erro de conexão com o servidor.');
        }
    };

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
});

async function loadCoordinators() {
    const grid = document.getElementById('coordinatorsGrid');
    try {
        const response = await fetch('/api/coordinators');
        const coordinators = await response.json();

        grid.innerHTML = coordinators.map(c => `
            <div class="entry-card">
                <div class="entry-header">
                    <span class="entry-class">${c.usuario}</span>
                    <span class="entry-date">${c.email}</span>
                </div>
                <div class="entry-body">
                    <p><strong>Unidades:</strong> ${c.unidades || 'Nenhuma vinculada'}</p>
                </div>
            </div>
        `).join('') || '<p class="empty-state">Nenhum coordenador cadastrado.</p>';

        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

async function loadUnitsForCheckboxes() {
    const container = document.getElementById('unitsCheckboxList');
    try {
        const response = await fetch('/api/unidades');
        const unidades = await response.json();

        if (unidades.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma unidade cadastrada ainda.</p>';
            return;
        }

        container.innerHTML = unidades.map(u => `
            <label class="checkbox-label">
                <input type="checkbox" value="${u.id}">
                <span>${u.escola} (${u.cidade})</span>
            </label>
        `).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="empty-state">Erro ao carregar unidades.</p>';
    }
}
