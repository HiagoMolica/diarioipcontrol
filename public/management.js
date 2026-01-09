// DOM Elements
const sections = {
    classesList: document.getElementById('classesListSection'),
    classDetail: document.getElementById('classDetailSection')
};
const classesGrid = document.getElementById('classesGrid');
const studentsGrid = document.getElementById('studentsGrid');

// Modals
const classModal = document.getElementById('classModal');
const studentModal = document.getElementById('studentModal');
const transferModal = document.getElementById('transferStudentModal');

// Forms & Inputs
const unitSelect = document.getElementById('unitSelect');
const studentClassSelect = document.getElementById('studentClassSelect');
const transferClassSelect = document.getElementById('transferClassSelect');

// Buttons
const btnOpenClassModal = document.getElementById('btnOpenClassModal'); // Main page button? Check HTML if exists
// Ideally we should check if elements exist before adding listeners to avoid null errors

// State
let editingId = null;
let selectedClassId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(userStr);
    const userNameHeader = document.getElementById('userNameHeader');
    if (userNameHeader) userNameHeader.textContent = user.usuario || 'Usuário';

    // Verify critical elements
    if (!classesGrid || !studentsGrid) {
        console.error('Critical elements missing');
        return;
    }

    // Load Initial Data
    await loadUnits(user.id);
    loadTurmas();

    // Event Listeners

    // Back Button
    const backBtn = document.getElementById('backToClassesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            sections.classDetail.style.display = 'none';
            sections.classesList.style.display = 'block';
            selectedClassId = null;
            loadTurmas(); // Refresh
        });
    }

    // New Class Button
    const createClassBtn = document.getElementById('openClassModal');
    if (createClassBtn) {
        createClassBtn.addEventListener('click', () => {
            editingId = null;
            document.getElementById('classForm').reset();
            const modalTitle = document.getElementById('classModalTitle');
            if (modalTitle) modalTitle.textContent = 'Nova Turma';
            if (classModal) classModal.classList.add('active');
        });
    }

    // New Student Button
    const createStudentBtn = document.getElementById('btnOpenStudentModal');
    if (createStudentBtn) {
        createStudentBtn.addEventListener('click', async () => {
            editingId = null;
            document.getElementById('studentForm').reset();
            const modalTitle = document.getElementById('studentModalTitle');
            if (modalTitle) modalTitle.textContent = 'Novo Aluno';

            await populateStudentClassSelect();
            if (selectedClassId && studentClassSelect) {
                studentClassSelect.value = selectedClassId;
            }
            if (studentModal) studentModal.classList.add('active');
        });
    }

    // Modal Close Buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal') || e.target.closest('.modal-overlay');
            if (modal) modal.classList.remove('active');
        });
    });

    // Form Submits
    const studentForm = document.getElementById('studentForm');
    if (studentForm) studentForm.addEventListener('submit', handleStudentSubmit);

    const classForm = document.getElementById('classForm');
    if (classForm) classForm.addEventListener('submit', handleClassSubmit);

    const transferForm = document.getElementById('transferStudentForm');
    if (transferForm) transferForm.addEventListener('submit', handleTransferSubmit);

    // Sidebar Links (Optional if handled by href)
    // ...

    // --- Functions ---

    async function loadUnits(userId) {
        try {
            const res = await fetch(`/api/users/${userId}/units`);
            const units = await res.json();
            console.log('Units Response:', units); // DEBUG
            if (unitSelect) {
                unitSelect.innerHTML = '<option value="">Selecione a Unidade...</option>' +
                    units.map(u => `<option value="${u.id}">${u.escola}</option>`).join('');
            }
        } catch (e) { console.error('Error loading units', e); }
    }

    async function loadTurmas() {
        try {
            const res = await fetch('/api/turmas');
            const turmas = await res.json();

            const userStr = localStorage.getItem('user');
            const user = JSON.parse(userStr);
            const unitsRes = await fetch(`/api/users/${user.id}/units`);
            const userUnits = await unitsRes.json();

            const filtered = turmas.filter(t => userUnits.some(u => u.id === t.unidade_id));
            renderTurmas(filtered);
        } catch (e) {
            console.error(e);
            if (classesGrid) classesGrid.innerHTML = '<p class="error-msg">Erro ao carregar turmas.</p>';
        }
    }

    function renderTurmas(turmas) {
        if (!classesGrid) return;
        if (turmas.length === 0) {
            classesGrid.innerHTML = '<p class="empty-state">Nenhuma turma encontrada.</p>';
            return;
        }

        classesGrid.innerHTML = turmas.map(t => `
            <div class="card" onclick="openClassDetail(${t.id}, '${t.nome}', '${t.serie}')" style="cursor: pointer; padding: 1.5rem; background: #fff; border-radius: 0.5rem; box-shadow: var(--shadow); transition: transform 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem;">${t.nome}</h3>
                        <p style="margin: 0.5rem 0; color: var(--text-muted);">${t.serie} Ano</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon" onclick="event.stopPropagation(); editClass(${JSON.stringify(t).replace(/"/g, '&quot;')})" style="color: var(--primary);">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="btn-icon" onclick="event.stopPropagation(); deleteClass(${t.id})" style="color: #ef4444;" title="Excluir Turma">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    window.openClassDetail = async (turmaId, nome, serie) => {
        selectedClassId = turmaId;
        sections.classesList.style.display = 'none';
        sections.classDetail.style.display = 'block';

        const nameEl = document.getElementById('detailClassName');
        const gradeEl = document.getElementById('detailClassGrade');

        if (nameEl) nameEl.textContent = nome || 'Turma';
        if (gradeEl) gradeEl.textContent = (serie ? `${serie} Ano` : '');

        loadAlunos(turmaId);
    };

    window.loadAlunos = async (turmaId) => {
        try {
            const res = await fetch(`/api/turmas/${turmaId}/alunos`);
            const alunos = await res.json();

            // Try to find class name if possible
            // const classRes = await fetch(`/api/turmas/${turmaId}`); ...

            renderAlunos(alunos);

            // Update Headers (if data available)
            // ...
        } catch (e) { console.error(e); }
    }

    function renderAlunos(alunos) {
        if (!studentsGrid) return;

        studentsGrid.innerHTML = alunos.map(s => `
            <div class="entry-list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f8fafc; margin-bottom: 0.5rem; border-radius: 0.5rem;">
                <div class="entry-info">
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">${s.nome}</h3>
                    <p style="margin: 0; font-size: 0.875rem; color: var(--text-light);">ID: ${s.id}</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-icon" onclick="editStudent(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="Editar" style="padding: 0.5rem; border-radius: 0.375rem; border: none; background: transparent; cursor: pointer; color: var(--text-muted);">
                        <i data-lucide="edit-3" style="width: 18px; height: 18px;"></i>
                    </button>
                    <button class="btn-icon" onclick="openTransferModal(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="Transferir Turma" style="padding: 0.5rem; border-radius: 0.375rem; border: none; background: transparent; cursor: pointer; color: var(--primary);">
                        <i data-lucide="arrow-right-left" style="width: 18px; height: 18px;"></i>
                    </button>
                </div>
            </div>
        `).join('') || '<p class="empty-state">Nenhum aluno nesta turma.</p>';

        // Force icon refresh
        if (window.lucide) window.lucide.createIcons();
    }

    // Handlers
    async function handleClassSubmit(e) {
        e.preventDefault();
        const nome = document.getElementById('classNameInput').value;
        const serie = document.getElementById('classGradeInput').value;
        const unidade_id = unitSelect.value;

        const method = editingId ? 'PUT' : 'POST';
        const url = editingId ? `/api/turmas/${editingId}` : '/api/turmas';

        try {
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, serie, unidade_id })
            });
            if (res.ok) {
                if (classModal) classModal.classList.remove('active');
                loadTurmas();
            }
        } catch (e) { console.error(e); }
    }

    async function handleStudentSubmit(e) {
        e.preventDefault();
        const nome = document.getElementById('studentNameInput').value;
        const turma_id = studentClassSelect.value;
        const data_nascimento = document.getElementById('studentDobInput').value;
        const nome_responsavel = document.getElementById('studentParentInput').value;
        const contato_responsavel = document.getElementById('studentContactInput').value;

        const method = editingId ? 'PUT' : 'POST';
        const url = editingId ? `/api/alunos/${editingId}` : '/api/alunos';

        try {
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, turma_id, data_nascimento, nome_responsavel, contato_responsavel })
            });
            if (res.ok) {
                if (studentModal) studentModal.classList.remove('active');
                if (selectedClassId) loadAlunos(selectedClassId);
            } else {
                alert('Erro ao salvar aluno');
            }
        } catch (e) { console.error(e); }
    }

    async function handleTransferSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('transferStudentId').value;
        const name = document.getElementById('transferStudentName').value;
        const newClassId = document.getElementById('transferClassSelect').value;

        const data_nascimento = document.getElementById('transferStudentDob').value;
        const nome_responsavel = document.getElementById('transferStudentParent').value;
        const contato_responsavel = document.getElementById('transferStudentContact').value;

        try {
            const res = await fetch(`/api/alunos/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: name,
                    turma_id: newClassId,
                    data_nascimento,
                    nome_responsavel,
                    contato_responsavel
                })
            });
            if (res.ok) {
                alert('Transferência realizada!');
                if (transferModal) transferModal.classList.remove('active');
                if (selectedClassId) loadAlunos(selectedClassId);
            } else { throw new Error('Falha'); }
        } catch (e) { console.error(e); alert('Erro ao transferir'); }
    }

    // Helpers
    // Populates both Student Modal Select and Transfer Modal Select
    async function populateStudentClassSelect() {
        const userStr = localStorage.getItem('user');
        if (!userStr) return;
        const user = JSON.parse(userStr);

        const unitsRes = await fetch(`/api/users/${user.id}/units`);
        const userUnits = await unitsRes.json(); // user.units might not exist

        const classesRes = await fetch('/api/turmas');
        const turmas = await classesRes.json();
        const filtered = turmas.filter(c => userUnits.some(u => u.id === c.unidade_id));

        const options = '<option value="">Selecione a turma...</option>' +
            filtered.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

        if (studentClassSelect) studentClassSelect.innerHTML = options;
        if (transferClassSelect) transferClassSelect.innerHTML = options;
    }

    window.editClass = (c) => {
        editingId = c.id;
        document.getElementById('classModalTitle').textContent = 'Editar Turma';
        document.getElementById('classNameInput').value = c.nome;
        document.getElementById('classGradeInput').value = c.serie;
        if (unitSelect) unitSelect.value = c.unidade_id;
        if (classModal) classModal.classList.add('active');
    };

    window.deleteClass = async (id) => {
        if (!confirm('Tem certeza que deseja excluir esta turma? Todos os alunos e aulas vinculados serão perdidos permanentemente.')) return;

        try {
            const res = await fetch(`/api/turmas/${id}`, { method: 'DELETE' });
            if (res.ok) {
                // If we are currently viewing this class details, go back
                if (selectedClassId === id) {
                    sections.classDetail.style.display = 'none';
                    sections.classesList.style.display = 'block';
                    selectedClassId = null;
                }
                loadTurmas();
                alert('Turma excluída com sucesso.');
            } else {
                const err = await res.json();
                alert('Erro ao excluir: ' + (err.error || 'Erro desconhecido'));
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao conectar com o servidor.');
        }
    };

    window.editStudent = (s) => {
        editingId = s.id;
        const title = document.getElementById('studentModalTitle');
        if (title) title.textContent = 'Editar Aluno';
        document.getElementById('studentNameInput').value = s.nome;
        document.getElementById('studentParentInput').value = s.nome_responsavel || '';
        document.getElementById('studentContactInput').value = s.contato_responsavel || '';

        if (s.data_nascimento) {
            document.getElementById('studentDobInput').value = s.data_nascimento.split('T')[0];
        } else {
            document.getElementById('studentDobInput').value = '';
        }

        populateStudentClassSelect().then(() => {
            if (studentClassSelect) studentClassSelect.value = s.turma_id;
        });
        if (studentModal) studentModal.classList.add('active');
    };

    window.openTransferModal = (s) => {
        document.getElementById('transferStudentId').value = s.id;
        document.getElementById('transferStudentName').value = s.nome;
        document.getElementById('transferStudentParent').value = s.nome_responsavel || '';
        document.getElementById('transferStudentContact').value = s.contato_responsavel || '';
        document.getElementById('transferStudentDob').value = s.data_nascimento ? s.data_nascimento.split('T')[0] : '';

        const display = document.getElementById('transferStudentNameDisplay');
        if (display) display.textContent = `Transferindo: ${s.nome}`;

        populateStudentClassSelect().then(() => {
            if (transferModal) transferModal.classList.add('active');
        });
    }
});
