document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'coordenador') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userNameHeader').textContent = user.name || user.username;

    loadInstructors();

    const modal = document.getElementById('entryModal');
    const btn = document.getElementById('openModal');
    const closeModal = document.getElementById('closeModal');
    const form = document.getElementById('instructorForm');
    let editingId = null;

    btn.onclick = () => {
        editingId = null;
        document.getElementById('modalTitle').textContent = 'Cadastrar Instrutor';
        document.getElementById('submitBtn').textContent = 'Registrar Instrutor';
        document.getElementById('passwordInput').required = true;
        document.getElementById('passwordInput').placeholder = 'Sua senha';
        form.reset();
        modal.classList.add('active');
        loadUnitsForCheckboxes();
    };

    closeModal.onclick = () => modal.classList.remove('active');
    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('active');
    };

    form.onsubmit = async (e) => {
        e.preventDefault();

        const selectedUnits = Array.from(document.querySelectorAll('#unitsCheckboxList input[type="checkbox"]:checked'))
            .map(cb => parseInt(cb.value));

        if (selectedUnits.length === 0) {
            alert('Por favor, selecione pelo menos uma unidade.');
            return;
        }

        const data = {
            name: document.getElementById('nameInput').value,
            email: document.getElementById('emailInput').value,
            password: document.getElementById('passwordInput').value || undefined,
            unitIds: selectedUnits
        };

        const url = editingId ? `/api/instructors/${editingId}` : '/api/instructors';
        const method = editingId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert(editingId ? 'Instrutor atualizado com sucesso!' : 'Instrutor cadastrado com sucesso!');
                modal.classList.remove('active');
                form.reset();
                loadInstructors();
            } else {
                const error = await response.json();
                alert('Erro ao processar instrutor: ' + (error.error || 'Erro desconhecido'));
            }
        } catch (err) {
            console.error(err);
            alert('Erro de conexão com o servidor.');
        }
    };

    window.editInstructor = async (instrutor) => {
        editingId = instrutor.id;
        document.getElementById('modalTitle').textContent = 'Editar Instrutor';
        document.getElementById('submitBtn').textContent = 'Salvar Alterações';
        document.getElementById('passwordInput').required = false;
        document.getElementById('passwordInput').placeholder = 'Deixe em branco para não alterar';

        document.getElementById('nameInput').value = instrutor.usuario;
        document.getElementById('emailInput').value = instrutor.email;
        document.getElementById('passwordInput').value = '';

        const assignedUnitNames = instrutor.unidades ? instrutor.unidades.split(',') : [];
        await loadUnitsForCheckboxes(assignedUnitNames);

        modal.classList.add('active');
    };

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
});

async function loadInstructors() {
    const user = JSON.parse(localStorage.getItem('user'));
    const grid = document.getElementById('instructorsGrid');
    try {
        const response = await fetch(`/api/instructors?coordinatorId=${user.id}`);
        const instructors = await response.json();

        grid.innerHTML = instructors.map(i => `
            <div class="entry-card">
                <div class="entry-header">
                    <span class="entry-class">${i.usuario}</span>
                    <button class="btn-edit-icon" onclick='editInstructor(${JSON.stringify(i)})'>
                        <i data-lucide="edit-3"></i>
                    </button>
                </div>
                <div class="entry-body">
                    <p><strong>Email:</strong> ${i.email}</p>
                    <p><strong>Unidades:</strong> ${i.unidades || 'Nenhuma vinculada'}</p>
                </div>
            </div>
        `).join('') || '<p class="empty-state">Nenhum instrutor cadastrado.</p>';

        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

async function loadUnitsForCheckboxes(assignedUnitNames = []) {
    const user = JSON.parse(localStorage.getItem('user'));
    const container = document.getElementById('unitsCheckboxList');
    try {
        // Fetch only units managed by THIS coordinator
        const response = await fetch(`/api/coordinators/${user.id}/units`);
        const unidades = await response.json();

        if (unidades.length === 0) {
            container.innerHTML = '<p class="empty-state">Você não possui unidades vinculadas.</p>';
            return;
        }

        container.innerHTML = unidades.map(u => `
            <label class="checkbox-label">
                <input type="checkbox" value="${u.id}" ${assignedUnitNames.includes(u.escola) ? 'checked' : ''}>
                <span>${u.escola} (${u.cidade})</span>
            </label>
        `).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="empty-state">Erro ao carregar suas unidades.</p>';
    }
}
