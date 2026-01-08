document.addEventListener('DOMContentLoaded', () => {
    // Authentication Check
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Role-based logic
    const nav = document.querySelector('aside.sidebar nav');
    if (user.role === 'ceo') {
        const ceoLink = document.createElement('a');
        ceoLink.href = 'schools.html';
        ceoLink.innerHTML = '<i data-lucide="school"></i> Gerenciar Escolas';

        const coordLink = document.createElement('a');
        coordLink.href = 'coordinators.html';
        coordLink.innerHTML = '<i data-lucide="users"></i> Gerenciar Coordenadores';

        // Insert before logout
        const logoutBtn = document.getElementById('logoutBtn');
        nav.insertBefore(ceoLink, logoutBtn);
        nav.insertBefore(coordLink, logoutBtn);
    }

    const currentUser = user;
    document.querySelector('.dashboard-header h1').textContent = `Bem-vindo de volta, ${currentUser.name.split(' ')[0]}!`;
    document.querySelector('.avatar').textContent = currentUser.name[0];

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    const lessonsGrid = document.getElementById('lessonsGrid');
    const totalStudentsEl = document.getElementById('totalStudents');
    const totalClassesEl = document.getElementById('totalClasses');
    const totalLessonsEl = document.getElementById('totalLessons');
    const lessonForm = document.getElementById('lessonForm');
    const modal = document.getElementById('entryModal');
    const openModalBtn = document.getElementById('openModal');
    const closeModalBtn = document.getElementById('closeModal');
    const classSelect = document.getElementById('classSelect');
    const studentList = document.getElementById('studentList');

    // Fetch and render stats
    async function fetchStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            totalStudentsEl.textContent = stats.totalStudents;
            totalClassesEl.textContent = stats.totalClasses;
            totalLessonsEl.textContent = stats.totalLessons;
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }

    // Fetch classes and populate dropdown
    async function fetchClasses() {
        try {
            const response = await fetch('/api/classes');
            const classes = await response.json();
            classSelect.innerHTML = '<option value="">Selecione...</option>';
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.id;
                option.textContent = `${cls.name} (${cls.grade})`;
                classSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    }

    // Fetch and render lessons
    async function fetchLessons() {
        try {
            const response = await fetch('/api/lessons');
            const lessons = await response.json();
            renderLessons(lessons);
        } catch (error) {
            console.error('Error fetching lessons:', error);
        }
    }

    function renderLessons(lessons) {
        lessonsGrid.innerHTML = '';
        if (lessons.length === 0) {
            lessonsGrid.innerHTML = '<p class="empty-state">Nenhum registro de aula encontrado.</p>';
            return;
        }
        lessons.forEach(lesson => {
            const date = new Date(lesson.date).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            const card = document.createElement('div');
            card.className = 'entry-card';
            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-date">${date}</span>
                    <span class="entry-mood">📚 ${lesson.class_name}</span>
                </div>
                <h3>${lesson.content}</h3>
                <p>${lesson.objectives || ''}</p>
            `;
            lessonsGrid.appendChild(card);
        });
    }

    // Handle class selection -> Load students
    classSelect.addEventListener('change', async () => {
        const classId = classSelect.value;
        if (!classId) {
            studentList.innerHTML = '<p class="empty-state">Selecione uma turma para ver os alunos.</p>';
            return;
        }

        try {
            const response = await fetch(`/api/classes/${classId}/students`);
            const students = await response.json();
            renderStudentAttendance(students);
        } catch (error) {
            console.error('Error fetching students:', error);
        }
    });

    function renderStudentAttendance(students) {
        studentList.innerHTML = '';
        students.forEach(student => {
            const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const item = document.createElement('div');
            item.className = 'student-item';
            item.innerHTML = `
                <div class="student-info">
                    <div class="student-initials">${initials}</div>
                    <span>${student.name}</span>
                </div>
                <div class="attendance-options">
                    <label>
                        <input type="radio" name="attendance_${student.id}" value="presente" checked> P
                    </label>
                    <label>
                        <input type="radio" name="attendance_${student.id}" value="ausente"> F
                    </label>
                </div>
            `;
            studentList.appendChild(item);
        });
    }

    // Modal logic
    openModalBtn.addEventListener('click', () => modal.classList.add('active'));
    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        lessonForm.reset();
        studentList.innerHTML = '<p class="empty-state">Selecione uma turma para ver os alunos.</p>';
    });

    // Form submission
    lessonForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const attendance = [];
        const studentItems = studentList.querySelectorAll('.student-item');
        studentItems.forEach(item => {
            const studentId = item.querySelector('input[type="radio"]').name.split('_')[1];
            const status = item.querySelector('input[type="radio"]:checked').value;
            attendance.push({ student_id: parseInt(studentId), status });
        });

        const newLesson = {
            class_id: parseInt(classSelect.value),
            content: document.getElementById('contentInput').value,
            objectives: document.getElementById('objectivesInput').value,
            attendance: attendance
        };

        try {
            const response = await fetch('/api/lessons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLesson)
            });

            if (response.ok) {
                lessonForm.reset();
                modal.classList.remove('active');
                studentList.innerHTML = '<p class="empty-state">Selecione uma turma para ver os alunos.</p>';
                fetchStats();
                fetchLessons();
            }
        } catch (error) {
            console.error('Error saving lesson:', error);
        }
    });

    // Initial load
    fetchStats();
    fetchClasses();
    fetchLessons();
});
