// DOM Elements
const classSelect = document.getElementById('classSelect');
const studentListSection = document.getElementById('studentListSection');
const studentsList = document.getElementById('studentsList');
const dateInput = document.getElementById('dateInput');
const diaryForm = document.getElementById('diaryForm');
const saveBtn = document.getElementById('saveDiaryBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');

// Filter Elements
const historyClassSelect = document.getElementById('historyClassSelect');
const historyDateSelect = document.getElementById('historyDateSelect');

let selectedClassId = null;
let currentStudents = [];
let editingDiaryId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Set today's date
    dateInput.valueAsDate = new Date();

    await loadClasses();
});

// Load Classes into Select (Both Form and History Filter)
async function loadClasses() {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            window.location.href = 'index.html';
            return;
        }
        const user = JSON.parse(userStr);
        document.getElementById('userNameHeader').textContent = user.usuario || 'Instrutor';

        const unitsRes = await fetch(`/api/users/${user.id}/units`);
        const units = await unitsRes.json();

        const classesRes = await fetch('/api/turmas');
        const allTurmas = await classesRes.json();

        const userClasses = allTurmas.filter(t => units.some(u => u.id === t.unidade_id));

        const options = '<option value="">Selecione...</option>' +
            userClasses.map(c => `<option value="${c.id}">${c.nome} (${c.serie} Ano)</option>`).join('');

        classSelect.innerHTML = options;
        historyClassSelect.innerHTML = options; // Populate filter as well

    } catch (error) {
        console.error('Error loading classes:', error);
        alert('Erro ao carregar turmas.');
    }
}

// Handle History Class Selection
historyClassSelect.addEventListener('change', async (e) => {
    const turmaId = e.target.value;
    historyDateSelect.innerHTML = '<option value="">Carregando...</option>';
    historyDateSelect.disabled = true;

    if (!turmaId) {
        historyDateSelect.innerHTML = '<option value="">Selecione uma turma primeiro</option>';
        return;
    }

    try {
        const res = await fetch(`/api/aulas?turmaId=${turmaId}`);
        const lessons = await res.json();

        if (lessons.length === 0) {
            historyDateSelect.innerHTML = '<option value="">Nenhum diário encontrado</option>';
        } else {
            historyDateSelect.innerHTML = '<option value="">Selecione uma data...</option>' +
                lessons.map(l => {
                    const d = new Date(l.data);
                    const day = d.getUTCDate().toString().padStart(2, '0');
                    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
                    const year = d.getUTCFullYear();
                    return `<option value="${l.id}">${day}/${month}/${year} - ${l.titulo || 'Sem título'}</option>`;
                }).join('');
            historyDateSelect.disabled = false;
        }

    } catch (error) {
        console.error('Error loading history dates:', error);
        historyDateSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
});

// Handle History Date Selection
historyDateSelect.addEventListener('change', async (e) => {
    const lessonId = e.target.value;
    if (lessonId) {
        await editDiary(lessonId);
    }
});

// Handle Form Class Selection
classSelect.addEventListener('change', async (e) => {
    selectedClassId = e.target.value;
    if (!selectedClassId) {
        studentListSection.style.display = 'none';
        return;
    }
    await loadStudents(selectedClassId);
});

async function loadStudents(turmaId) {
    try {
        const res = await fetch(`/api/turmas/${turmaId}/alunos`);
        currentStudents = await res.json();

        renderStudentList();
        studentListSection.style.display = 'block';
    } catch (error) {
        console.error('Error loading students:', error);
        alert('Erro ao carregar alunos.');
    }
}

// Render Student List with Attendance and Grade Inputs
function renderStudentList(savedFrequency = []) {
    if (currentStudents.length === 0) {
        studentsList.innerHTML = '<p class="empty-state">Nenhum aluno nesta turma.</p>';
        return;
    }

    studentsList.innerHTML = currentStudents.map(student => {
        const saved = savedFrequency.find(f => f.aluno_id === student.id);
        const isPresent = saved ? saved.status === 'presente' : true;
        const isAbsent = saved ? saved.status === 'ausente' : false;
        const grade = saved && saved.nota ? saved.nota : '';

        return `
        <div class="entry-list-item student-row" data-id="${student.id}" style="display: grid; grid-template-columns: 2fr 1fr 1fr; cursor: default;">
            <div class="entry-info">
                <h3>${student.nome}</h3>
            </div>
            <div class="attendance-options">
                <label>
                    <input type="radio" name="attendance_${student.id}" value="presente" ${isPresent ? 'checked' : ''}> Presente
                </label>
                <label>
                    <input type="radio" name="attendance_${student.id}" value="ausente" ${isAbsent ? 'checked' : ''}> Ausente
                </label>
            </div>
            <div class="grade-input">
                <input type="number" min="0" max="10" step="0.1" name="grade_${student.id}" value="${grade}" placeholder="Nota" class="input-grade" style="width: 80px; padding: 0.25rem;">
            </div>
        </div>
    `}).join('');
}

// Edit Diary Logic
window.editDiary = async (id) => {
    try {
        const res = await fetch(`/api/aulas/${id}`);
        if (!res.ok) throw new Error('Failed to fetch');

        const lesson = await res.json();

        // 1. Set Edit Mode
        editingDiaryId = id;
        formTitle.textContent = `Editando: ${lesson.titulo || 'Aula'}`;
        cancelEditBtn.style.display = 'block';
        saveBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Atualizar Diário';

        // 2. Populate Form
        classSelect.value = lesson.turma_id;
        selectedClassId = lesson.turma_id;
        // Fix timezone issue: use the YYYY-MM-DD part directly from ISO string
        if (lesson.data) {
            const dateObj = new Date(lesson.data);
            // Adjust for timezone offset to ensure we get the correct YYYY-MM-DD
            // Or simply use split if the server returns ISO. 
            // Ideally: dateInput.value = lesson.data.substring(0, 10); if consistent.
            // Safer cross-timezone:
            dateInput.value = dateObj.toISOString().split('T')[0];
        }
        document.getElementById('titleInput').value = lesson.titulo || '';
        document.getElementById('contentInput').value = lesson.conteudo || '';

        // 3. Load Students & Frequency
        await loadStudents(lesson.turma_id);
        // loadStudents renders default list, so we re-render with saved data
        renderStudentList(lesson.frequencia);

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (e) {
        console.error(e);
        alert('Erro ao carregar diário para edição.');
    }
};

// Cancel Edit
cancelEditBtn.onclick = () => {
    editingDiaryId = null;
    formTitle.textContent = 'Novo Diário';
    cancelEditBtn.style.display = 'none';
    saveBtn.innerHTML = '<i data-lucide="save"></i> Salvar Diário';
    diaryForm.reset();
    dateInput.valueAsDate = new Date();
    studentListSection.style.display = 'none';
    classSelect.value = '';
    selectedClassId = null;

    // Reset filters
    historyClassSelect.value = '';
    historyDateSelect.innerHTML = '<option value="">Selecione uma turma primeiro</option>';
    historyDateSelect.disabled = true;
};

// Handle Form Submit
diaryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedClassId) {
        alert('Selecione uma turma.');
        return;
    }

    const title = document.getElementById('titleInput').value;
    const date = dateInput.value;
    const content = document.getElementById('contentInput').value;

    const frequencia = currentStudents.map(student => {
        const status = document.querySelector(`input[name="attendance_${student.id}"]:checked`).value;
        const gradeInput = document.querySelector(`input[name="grade_${student.id}"]`);
        const grade = gradeInput.value ? parseFloat(gradeInput.value) : 0;

        return {
            aluno_id: student.id,
            status: status,
            nota: grade
        };
    });

    const payload = {
        turma_id: selectedClassId,
        titulo: title,
        data: date,
        conteudo: content || '',
        objetivos: '',
        frequencia: frequencia
    };

    try {
        const url = editingDiaryId ? `/api/aulas/${editingDiaryId}` : '/api/aulas';
        const method = editingDiaryId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(editingDiaryId ? 'Diário atualizado!' : 'Diário lançado com sucesso!');
            cancelEditBtn.click(); // Resets form
        } else {
            throw new Error('Erro ao salvar');
        }
    } catch (error) {
        console.error('Error saving diary:', error);
        alert('Erro ao salvar diário. Tente novamente.');
    }
});
