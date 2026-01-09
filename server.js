const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL Database setup (for Users)
const mysqlConn = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

mysqlConn.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
    } else {
        console.log('Connected to the MySQL database.');
        // Create Junction Table if not exists
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS coordenadores_unidades (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT,
                unidade_id INT,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
                FOREIGN KEY (unidade_id) REFERENCES unidades(id)
            )
        `;
        mysqlConn.query(createTableQuery, (err) => {
            if (err) console.error('Error creating junction table:', err.message);
        });

        // Create Instructor junction table
        const createInstructorTableQuery = `
            CREATE TABLE IF NOT EXISTS instrutores_unidades (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT,
                unidade_id INT,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
                FOREIGN KEY (unidade_id) REFERENCES unidades(id)
            )
        `;
        mysqlConn.query(createInstructorTableQuery, (err) => {
            if (err) console.error('Error creating instructor junction table:', err.message);
        });


        // Cleanup old tables (Optional - only if we want to force migration)
        mysqlConn.query('DROP TABLE IF EXISTS attendance');
        mysqlConn.query('DROP TABLE IF EXISTS lessons');
        mysqlConn.query('DROP TABLE IF EXISTS students');
        mysqlConn.query('DROP TABLE IF EXISTS classes');

        // Turmas table
        mysqlConn.query(`
            CREATE TABLE IF NOT EXISTS turmas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                serie VARCHAR(255) NOT NULL,
                unidade_id INT,
                FOREIGN KEY (unidade_id) REFERENCES unidades(id)
            )
        `);

        // Alunos table
        mysqlConn.query(`
            CREATE TABLE IF NOT EXISTS alunos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                data_nascimento DATE,
                nome_responsavel VARCHAR(255),
                contato_responsavel VARCHAR(255),
                turma_id INT,
                FOREIGN KEY (turma_id) REFERENCES turmas(id)
            )
        `);

        // ... Aulas, Frequencia ...
    }

    // Migrations to ensure columns exist (Run after tables are ensured)
    setTimeout(() => {
        try {
            // Add 'titulo' to 'aulas'
            mysqlConn.query("ALTER TABLE aulas ADD COLUMN titulo VARCHAR(255)", (err) => {
                if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Migration Warning (aulas):', err.message);
            });

            // Add 'nota' to 'frequencia'
            mysqlConn.query("ALTER TABLE frequencia ADD COLUMN nota DECIMAL(4,2) DEFAULT 0", (err) => {
                if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Migration Warning (frequencia):', err.message);
            });

            // Add New Fields to 'alunos'
            mysqlConn.query("ALTER TABLE alunos ADD COLUMN data_nascimento DATE", (err) => {
                if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Migration Warning (alunos dob):', err.message);
            });
            mysqlConn.query("ALTER TABLE alunos ADD COLUMN nome_responsavel VARCHAR(255)", (err) => {
                if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Migration Warning (alunos parent):', err.message);
            });
            mysqlConn.query("ALTER TABLE alunos ADD COLUMN contato_responsavel VARCHAR(255)", (err) => {
                if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Migration Warning (alunos contact):', err.message);
            });

        } catch (e) {
            console.error("Migration Error:", e);
        }
    }, 1000); // Small delay to let CREATE TABLEs finish
});

// Routes

// Login (Using MySQL)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM usuarios WHERE usuario = ? AND senha = ?';

    mysqlConn.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ error: 'Usuário ou senha incorretos' });

        const user = results[0];
        res.json({
            message: 'Login realizado com sucesso',
            user: {
                id: user.id,
                username: user.usuario,
                name: user.usuario,
                email: user.email,
                role: user.role // Including the role for frontend logic
            }
        });
    });
});

// Unidades (School Units) - MySQL
app.get('/api/unidades', (req, res) => {
    const query = `
        SELECT u.*, EXISTS(SELECT 1 FROM coordenadores_unidades cu WHERE cu.unidade_id = u.id) as esta_ocupada
        FROM unidades u
    `;
    mysqlConn.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/users/:id/units', (req, res) => {
    const { id } = req.params;

    // First check user role to decide which table to join
    mysqlConn.query('SELECT role FROM usuarios WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'User not found' });

        const role = results[0].role;
        let query = '';

        if (role === 'coordenador') {
            query = `
                SELECT u.* FROM unidades u
                JOIN coordenadores_unidades cu ON u.id = cu.unidade_id
                WHERE cu.usuario_id = ?
            `;
        } else if (role === 'instrutor') {
            query = `
                SELECT u.* FROM unidades u
                JOIN instrutores_unidades iu ON u.id = iu.unidade_id
                WHERE iu.usuario_id = ?
            `;
        } else {
            // If admin or other, maybe return all? or none? 
            // For now, return empty or all depends on logic. Let's return empty if not specific.
            return res.json([]);
        }

        mysqlConn.query(query, [id], (err, units) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(units);
        });
    });
});

app.post('/api/unidades', (req, res) => {
    const { pais, estado, cidade, escola } = req.body;
    const query = 'INSERT INTO unidades (pais, estado, cidade, escola) VALUES (?, ?, ?, ?)';

    mysqlConn.query(query, [pais, estado, cidade, escola], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: result.insertId, message: 'Unidade registrada com sucesso' });
    });
});

app.put('/api/unidades/:id', (req, res) => {
    const { id } = req.params;
    const { pais, estado, cidade, escola } = req.body;
    const query = 'UPDATE unidades SET pais = ?, estado = ?, cidade = ?, escola = ? WHERE id = ?';

    mysqlConn.query(query, [pais, estado, cidade, escola, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Unidade não encontrada' });
        res.json({ message: 'Unidade atualizada com sucesso' });
    });
});

// Coordinators Management
app.get('/api/coordinators', (req, res) => {
    const query = `
        SELECT u.id, u.usuario, u.email, GROUP_CONCAT(un.escola) as unidades
        FROM usuarios u
        LEFT JOIN coordenadores_unidades cu ON u.id = cu.usuario_id
        LEFT JOIN unidades un ON cu.unidade_id = un.id
        WHERE u.role = 'coordenador'
        GROUP BY u.id
    `;
    mysqlConn.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/coordinators', (req, res) => {
    const { name, email, password, unitIds } = req.body;

    // 1. Create User
    const userQuery = 'INSERT INTO usuarios (usuario, email, senha, role) VALUES (?, ?, ?, "coordenador")';
    mysqlConn.query(userQuery, [name, email, password], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const userId = result.insertId;

        // 2. Link to Units
        if (unitIds && unitIds.length > 0) {
            const values = unitIds.map(unitId => [userId, unitId]);
            const linkQuery = 'INSERT INTO coordenadores_unidades (usuario_id, unidade_id) VALUES ?';
            mysqlConn.query(linkQuery, [values], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'Coordenador cadastrado e vinculado com sucesso' });
            });
        } else {
            res.status(201).json({ message: 'Coordenador cadastrado sem unidades' });
        }
    });
});

app.put('/api/coordinators/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, password, unitIds } = req.body;

    // 1. Update User (only update password if provided)
    let userQuery = 'UPDATE usuarios SET usuario = ?, email = ?';
    let params = [name, email];
    if (password) {
        userQuery += ', senha = ?';
        params.push(password);
    }
    userQuery += ' WHERE id = ?';
    params.push(id);

    mysqlConn.query(userQuery, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // 2. Update Units (Delete existing and insert new)
        mysqlConn.query('DELETE FROM coordenadores_unidades WHERE usuario_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            if (unitIds && unitIds.length > 0) {
                const values = unitIds.map(unitId => [id, unitId]);
                const linkQuery = 'INSERT INTO coordenadores_unidades (usuario_id, unidade_id) VALUES ?';
                mysqlConn.query(linkQuery, [values], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Coordenador atualizado com sucesso' });
                });
            } else {
                res.json({ message: 'Coordenador atualizado com sucesso (sem unidades)' });
            }
        });
    });
});

// Instructor Management
app.get('/api/instructors', (req, res) => {
    const { coordinatorId } = req.query;

    let query = `
        SELECT u.id, u.usuario, u.email, GROUP_CONCAT(un.escola) as unidades
        FROM usuarios u
        LEFT JOIN instrutores_unidades iu ON u.id = iu.usuario_id
        LEFT JOIN unidades un ON iu.unidade_id = un.id
        WHERE u.role = 'instrutor'
    `;

    if (coordinatorId) {
        query += ` AND iu.unidade_id IN (SELECT unidade_id FROM coordenadores_unidades WHERE usuario_id = ?)`;
    }

    query += ` GROUP BY u.id`;

    mysqlConn.query(query, coordinatorId ? [coordinatorId] : [], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/instructors', (req, res) => {
    const { name, email, password, unitIds } = req.body;

    const userQuery = 'INSERT INTO usuarios (usuario, email, senha, role) VALUES (?, ?, ?, "instrutor")';
    mysqlConn.query(userQuery, [name, email, password], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const userId = result.insertId;

        if (unitIds && unitIds.length > 0) {
            const values = unitIds.map(unitId => [userId, unitId]);
            const linkQuery = 'INSERT INTO instrutores_unidades (usuario_id, unidade_id) VALUES ?';
            mysqlConn.query(linkQuery, [values], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'Instrutor cadastrado e vinculado com sucesso' });
            });
        } else {
            res.status(201).json({ message: 'Instrutor cadastrado sem unidades' });
        }
    });
});

app.put('/api/instructors/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, password, unitIds } = req.body;

    let userQuery = 'UPDATE usuarios SET usuario = ?, email = ?';
    let params = [name, email];
    if (password) {
        userQuery += ', senha = ?';
        params.push(password);
    }
    userQuery += ' WHERE id = ?';
    params.push(id);

    mysqlConn.query(userQuery, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        mysqlConn.query('DELETE FROM instrutores_unidades WHERE usuario_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            if (unitIds && unitIds.length > 0) {
                const values = unitIds.map(unitId => [id, unitId]);
                const linkQuery = 'INSERT INTO instrutores_unidades (usuario_id, unidade_id) VALUES ?';
                mysqlConn.query(linkQuery, [values], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Instrutor atualizado com sucesso' });
                });
            } else {
                res.json({ message: 'Instrutor atualizado com sucesso (sem unidades)' });
            }
        });
    });
});

// Coordinator's Units
app.get('/api/coordinators/:id/units', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT u.* FROM unidades u
        JOIN coordenadores_unidades cu ON u.id = cu.unidade_id
        WHERE cu.usuario_id = ?
    `;
    mysqlConn.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Instructor's Units
app.get('/api/instructors/:id/units', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT u.* FROM unidades u
        JOIN instrutores_unidades iu ON u.id = iu.unidade_id
        WHERE iu.usuario_id = ?
    `;
    mysqlConn.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Turmas (Classes)
app.get('/api/turmas', (req, res) => {
    const { unidadeId } = req.query; // changed param name to match
    let query = 'SELECT * FROM turmas'; // changed table
    let params = [];

    if (unidadeId) {
        query += ' WHERE unidade_id = ?'; // changed column
        params.push(unidadeId);
    }

    mysqlConn.query(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/turmas', (req, res) => {
    const { nome, serie, unidade_id } = req.body; // changed fields
    mysqlConn.query('INSERT INTO turmas (nome, serie, unidade_id) VALUES (?, ?, ?)', [nome, serie, unidade_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: result.insertId, message: 'Turma criada com sucesso' });
    });
});

app.put('/api/turmas/:id', (req, res) => {
    const { id } = req.params;
    const { nome, serie, unidade_id } = req.body;
    mysqlConn.query('UPDATE turmas SET nome = ?, serie = ?, unidade_id = ? WHERE id = ?', [nome, serie, unidade_id, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Turma atualizada com sucesso' });
    });
});

app.delete('/api/turmas/:id', (req, res) => {
    const { id } = req.params;

    // Manual Cascade Delete: Aulas -> Alunos -> Turmas
    // Note: Frequencia deletes automatically due to ON DELETE CASCADE on Aulas/Alunos

    mysqlConn.query('DELETE FROM aulas WHERE turma_id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao excluir aulas da turma: ' + err.message });

        mysqlConn.query('DELETE FROM alunos WHERE turma_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: 'Erro ao excluir alunos da turma: ' + err.message });

            mysqlConn.query('DELETE FROM turmas WHERE id = ?', [id], (err) => {
                if (err) return res.status(500).json({ error: 'Erro ao excluir turma: ' + err.message });
                res.json({ message: 'Turma e dados vinculados excluídos com sucesso' });
            });
        });
    });
});

// Alunos (Students)
app.get('/api/alunos', (req, res) => {
    const { turmaId } = req.query; // changed param
    let query = 'SELECT a.*, t.nome as turma_nome FROM alunos a JOIN turmas t ON a.turma_id = t.id'; // changed tables/cols
    let params = [];

    if (turmaId) {
        query += ' WHERE a.turma_id = ?';
        params.push(turmaId);
    }

    mysqlConn.query(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/alunos', (req, res) => {
    const { nome, turma_id, data_nascimento, nome_responsavel, contato_responsavel } = req.body;
    mysqlConn.query(
        'INSERT INTO alunos (nome, turma_id, data_nascimento, nome_responsavel, contato_responsavel) VALUES (?, ?, ?, ?, ?)',
        [nome, turma_id, data_nascimento, nome_responsavel, contato_responsavel],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: result.insertId, message: 'Aluno cadastrado com sucesso' });
        });
});

app.put('/api/alunos/:id', (req, res) => {
    const { id } = req.params;
    const { nome, turma_id, data_nascimento, nome_responsavel, contato_responsavel } = req.body;

    mysqlConn.query(
        'UPDATE alunos SET nome = ?, turma_id = ?, data_nascimento = ?, nome_responsavel = ?, contato_responsavel = ? WHERE id = ?',
        [nome, turma_id, data_nascimento, nome_responsavel, contato_responsavel, id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Aluno atualizado com sucesso' });
        });
});

// Alunos por Turma
app.get('/api/turmas/:id/alunos', (req, res) => {
    mysqlConn.query('SELECT * FROM alunos WHERE turma_id = ?', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Estatisticas (Stats)
app.get('/api/estatisticas', (req, res) => {
    const stats = {};
    mysqlConn.query('SELECT COUNT(*) as count FROM alunos', (err, result) => {
        stats.totalAlunos = result[0].count; // changed key
        mysqlConn.query('SELECT COUNT(*) as count FROM turmas', (err, result) => {
            stats.totalTurmas = result[0].count; // changed key
            mysqlConn.query('SELECT COUNT(*) as count FROM aulas', (err, result) => {
                stats.totalAulas = result[0].count; // changed key
                res.json(stats);
            });
        });
    });
});

// Aulas (Lessons)
app.get('/api/aulas', (req, res) => {
    const { turmaId } = req.query;
    let sql = `
    SELECT aulas.*, turmas.nome as turma_nome 
    FROM aulas 
    JOIN turmas ON aulas.turma_id = turmas.id 
  `;
    const params = [];

    if (turmaId) {
        sql += ' WHERE aulas.turma_id = ?';
        params.push(turmaId);
    }

    sql += ' ORDER BY data DESC';

    mysqlConn.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/aulas', (req, res) => {
    const { turma_id, titulo, conteudo, objetivos, frequencia, data } = req.body;

    const dataAula = data ? new Date(data) : new Date();

    mysqlConn.query('INSERT INTO aulas (turma_id, titulo, conteudo, objetivos, data) VALUES (?, ?, ?, ?, ?)',
        [turma_id, titulo, conteudo, objetivos, dataAula],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            const aulaId = result.insertId;

            // Save attendance if provided
            if (frequencia && Array.isArray(frequencia) && frequencia.length > 0) {
                const values = frequencia.map(f => [aulaId, f.aluno_id, f.status, f.nota || 0]); // include grade
                const query = 'INSERT INTO frequencia (aula_id, aluno_id, status, nota) VALUES ?';
                mysqlConn.query(query, [values], (err) => {
                    if (err) console.error('Error saving attendance:', err.message);
                });
            }

            res.status(201).json({ id: aulaId, message: 'Aula registrada com sucesso' });
        }
    );
});

// Get specific lesson details
app.get('/api/aulas/:id', (req, res) => {
    const { id } = req.params;

    // 1. Get Lesson Info
    mysqlConn.query('SELECT * FROM aulas WHERE id = ?', [id], (err, lessonResult) => {
        if (err) return res.status(500).json({ error: err.message });
        if (lessonResult.length === 0) return res.status(404).json({ error: 'Aula não encontrada' });

        const lesson = lessonResult[0];

        // 2. Get Attendance/Grades
        const freqQuery = `
            SELECT f.*, a.nome as aluno_nome 
            FROM frequencia f
            JOIN alunos a ON f.aluno_id = a.id
            WHERE f.aula_id = ?
        `;
        mysqlConn.query(freqQuery, [id], (err, freqResult) => {
            if (err) return res.status(500).json({ error: err.message });

            lesson.frequencia = freqResult;
            res.json(lesson);
        });
    });
});

// Update lesson
app.put('/api/aulas/:id', (req, res) => {
    const { id } = req.params;
    const { turma_id, titulo, conteudo, objetivos, frequencia, data } = req.body;

    const dataAula = data ? new Date(data) : new Date();

    // 1. Update Lesson Data
    mysqlConn.query(
        'UPDATE aulas SET turma_id = ?, titulo = ?, conteudo = ?, objetivos = ?, data = ? WHERE id = ?',
        [turma_id, titulo, conteudo, objetivos, dataAula, id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // 2. Update Frequency (Delete all and re-insert)
            mysqlConn.query('DELETE FROM frequencia WHERE aula_id = ?', [id], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                if (frequencia && Array.isArray(frequencia) && frequencia.length > 0) {
                    const values = frequencia.map(f => [id, f.aluno_id, f.status, f.nota || 0]);
                    const query = 'INSERT INTO frequencia (aula_id, aluno_id, status, nota) VALUES ?';
                    mysqlConn.query(query, [values], (err) => {
                        if (err) console.error('Error updating attendance:', err.message);
                        res.json({ message: 'Aula atualizada com sucesso' });
                    });
                } else {
                    res.json({ message: 'Aula atualizada com sucesso' });
                }
            });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
