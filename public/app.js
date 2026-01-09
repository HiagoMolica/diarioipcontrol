document.addEventListener('DOMContentLoaded', () => {
    // Authentication Check
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Role-based logic
    const nav = document.getElementById('sidebarNav') || document.querySelector('aside.sidebar nav');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user.role === 'ceo') {
        const ceoLink = document.createElement('a');
        ceoLink.href = 'schools.html';
        ceoLink.innerHTML = '<i data-lucide="school"></i> Gerenciar Escolas';

        const coordLink = document.createElement('a');
        coordLink.href = 'coordinators.html';
        coordLink.innerHTML = '<i data-lucide="users"></i> Gerenciar Coordenadores';

        nav.insertBefore(ceoLink, logoutBtn);
        nav.insertBefore(coordLink, logoutBtn);
    } else if (user.role === 'coordenador') {
        const instLink = document.createElement('a');
        instLink.href = 'instructors.html';
        instLink.innerHTML = '<i data-lucide="users"></i> Gerenciar Instrutores';

        const mgmtLink = document.createElement('a');
        mgmtLink.href = 'management.html';
        mgmtLink.innerHTML = '<i data-lucide="book-open"></i> Gerenciar Turmas';

        nav.insertBefore(instLink, logoutBtn);
    }

    const currentUser = user;
    const headerTitle = document.getElementById('welcomeTitle');
    if (headerTitle) {
        headerTitle.textContent = `Olá, ${currentUser.name.split(' ')[0]}!`;
    }
    const avatar = document.querySelector('.avatar');
    if (avatar) {
        avatar.textContent = currentUser.name[0];
    }

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

    // Fetch and render stats
    async function fetchStats() {
        try {
            const response = await fetch('/api/estatisticas');
            const stats = await response.json();
            totalStudentsEl.textContent = stats.totalAlunos;
            totalClassesEl.textContent = stats.totalTurmas;
            totalLessonsEl.textContent = stats.totalAulas;
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }

    // Fetch and render lessons
    async function fetchLessons() {
        try {
            const response = await fetch('/api/aulas');
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
            const date = new Date(lesson.data).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            const card = document.createElement('div');
            card.className = 'entry-card';
            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-date">${date}</span>
                    <span class="entry-mood">📚 ${lesson.turma_nome}</span>
                </div>
                <h3>${lesson.conteudo}</h3>
                <p>${lesson.objetivos || ''}</p>
            `;
            lessonsGrid.appendChild(card);
        });
    }

    // Initial load
    fetchStats();
    fetchLessons();
});
