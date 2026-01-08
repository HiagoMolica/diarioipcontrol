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

    btn.onclick = () => modal.classList.add('active');
    span.onclick = () => modal.classList.remove('active');
    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('active');
    };

    // Form logic
    const form = document.getElementById('unidadeForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            escola: document.getElementById('escolaInput').value,
            pais: document.getElementById('paisInput').value,
            estado: document.getElementById('estadoInput').value,
            cidade: document.getElementById('cidadeInput').value
        };

        try {
            const response = await fetch('/api/unidades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Unidade cadastrada com sucesso!');
                modal.classList.remove('active');
                form.reset();
                loadUnidades();
            } else {
                alert('Erro ao cadastrar unidade.');
            }
        } catch (err) {
            console.error(err);
        }
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
                    <span class="entry-date">${u.cidade} - ${u.estado}</span>
                </div>
                <div class="entry-body">
                    <p><strong>País:</strong> ${u.pais}</p>
                </div>
            </div>
        `).join('') || '<p class="empty-state">Nenhuma unidade cadastrada.</p>';

        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}
