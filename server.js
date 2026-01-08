const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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
    }
});

// SQLite Database setup (for School Data)
const db = new sqlite3.Database('./diary.db', (err) => {
    if (err) {
        console.error('Error opening SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Classes table
        db.run(`CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT NOT NULL
    )`);

        // Students table
        db.run(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_id INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes (id)
    )`);

        // Lessons table (Diary Entries for teachers)
        db.run(`CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      content TEXT NOT NULL,
      objectives TEXT,
      FOREIGN KEY (class_id) REFERENCES classes (id)
    )`);

        // Attendance table
        db.run(`CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER,
      student_id INTEGER,
      status TEXT CHECK(status IN ('presente', 'ausente')),
      FOREIGN KEY (lesson_id) REFERENCES lessons (id),
      FOREIGN KEY (student_id) REFERENCES students (id)
    )`);

        // Seed initial data if empty (SQLite for school data)
        db.get("SELECT count(*) as count FROM classes", (err, row) => {
            if (row.count === 0) {
                db.run("INSERT INTO classes (name, grade) VALUES ('9º A', 'Fundamental II'), ('1º B', 'Ensino Médio')");
                db.run("INSERT INTO students (name, class_id) VALUES ('Alice Rocha', 1), ('Bruno Silva', 1), ('Carlos Souza', 1), ('Daniela Lima', 2), ('Eduardo Gomes', 2)");
            }
        });
    });
}

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
    mysqlConn.query('SELECT * FROM unidades', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
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

// Classes
app.get('/api/classes', (req, res) => {
    db.all('SELECT * FROM classes', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Students by Class
app.get('/api/classes/:id/students', (req, res) => {
    db.all('SELECT * FROM students WHERE class_id = ?', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Stats for dashboard
app.get('/api/stats', (req, res) => {
    const stats = {};
    db.get('SELECT COUNT(*) as count FROM students', (err, row) => {
        stats.totalStudents = row.count;
        db.get('SELECT COUNT(*) as count FROM classes', (err, row) => {
            stats.totalClasses = row.count;
            db.get('SELECT COUNT(*) as count FROM lessons', (err, row) => {
                stats.totalLessons = row.count;
                res.json(stats);
            });
        });
    });
});

// Lessons
app.get('/api/lessons', (req, res) => {
    const sql = `
    SELECT lessons.*, classes.name as class_name 
    FROM lessons 
    JOIN classes ON lessons.class_id = classes.id 
    ORDER BY date DESC
  `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/lessons', (req, res) => {
    const { class_id, content, objectives, attendance } = req.body;

    db.run('INSERT INTO lessons (class_id, content, objectives) VALUES (?, ?, ?)',
        [class_id, content, objectives],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const lessonId = this.lastID;

            // Save attendance if provided
            if (attendance && Array.isArray(attendance)) {
                const stmt = db.prepare('INSERT INTO attendance (lesson_id, student_id, status) VALUES (?, ?, ?)');
                attendance.forEach(att => {
                    stmt.run(lessonId, att.student_id, att.status);
                });
                stmt.finalize();
            }

            res.status(201).json({ id: lessonId, message: 'Lesson recorded successfully' });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
