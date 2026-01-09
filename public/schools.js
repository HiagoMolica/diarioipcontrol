document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'ceo') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userNameHeader').textContent = user.name || user.username;

    // Load Units
    loadUnidades();

    // Modal logic
    const modal = document.getElementById('entryModal');
    const btn = document.getElementById('openModal');
    const span = document.getElementById('closeModal');

    // Form logic
    const form = document.getElementById('unidadeForm');
    let editingId = null;

    btn.onclick = () => {
        editingId = null;
        document.getElementById('modalTitle').textContent = 'Cadastrar Unidade';
        document.getElementById('submitBtn').textContent = 'Registrar Unidade';
        form.reset();
        modal.classList.add('active');
    };

    span.onclick = () => modal.classList.remove('active');
    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('active');
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            escola: document.getElementById('escolaInput').value,
            pais: document.getElementById('paisInput').value,
            estado: document.getElementById('estadoInput').value,
            cidade: document.getElementById('cidadeInput').value
        };

        const url = editingId ? `/api/unidades/${editingId}` : '/api/unidades';
        const method = editingId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert(editingId ? 'Unidade atualizada com sucesso!' : 'Unidade cadastrada com sucesso!');
                modal.classList.remove('active');
                form.reset();
                loadUnidades();
            } else {
                alert('Erro ao processar unidade.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Global edit function
    window.editUnidade = (u) => {
        editingId = u.id;
        document.getElementById('modalTitle').textContent = 'Editar Unidade';
        document.getElementById('submitBtn').textContent = 'Salvar Alterações';

        document.getElementById('escolaInput').value = u.escola;
        document.getElementById('paisInput').value = u.pais;
        document.getElementById('estadoInput').value = u.estado;
        document.getElementById('cidadeInput').value = u.cidade;

        modal.classList.add('active');
    };

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
});

async function loadUnidades() {
    const grid = document.getElementById('unidadesGrid');
    try {
        const response = await fetch('/api/unidades');
        const unidades = await response.json();

        grid.innerHTML = unidades.map(u => `
            <div class="entry-card">
                <div class="entry-header">
                    <span class="entry-class">${u.escola}</span>
                    <button class="btn-edit-icon" onclick='editUnidade(${JSON.stringify(u)})'>
                        <i data-lucide="edit-3"></i>
                    </button>
                </div>
                <div class="entry-body">
                    <p><strong>Cidade:</strong> ${u.cidade} - ${u.estado}</p>
                    <p><strong>País:</strong> ${u.pais}</p>
                </div>
            </div>
        `).join('') || '<p class="empty-state">Nenhuma unidade cadastrada.</p>';

        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}
