// server.js - Serveur Node.js pour NBFO Coopérative

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: true }));

// Configuration PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});
  
  /*const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'nbfo',
  password: process.env.PGPASSWORD || '3050P@ss',
  port: process.env.PGPORT || 5432,
});*/

// Test de connexion à la base de données
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur de connexion à PostgreSQL:', err.stack);
  } else {
    console.log('✅ Connecté à PostgreSQL');
    release();
  }
});

// Utilitaire : exécuter une requête avec utilisateur contexte
async function dbQueryWithUser(utilisateur, text, params = []) {
  const client = await pool.connect();
  try {
    if (utilisateur) {
      await client.query('SELECT set_config($1, $2, true)', ['nbfo.current_user', utilisateur]);
    }
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// Utilitaire d'audit
async function logAction(utilisateur, action, table_cible) {
  try {
    await pool.query(
      'INSERT INTO audit_log (utilisateur, action, table_cible) VALUES ($1,$2,$3)',
      [utilisateur, action, table_cible]
    );
  } catch (err) {
    console.error('Erreur audit_log:', err);
  }
}

/* =========================
   ROUTES API
   ========================= */

// Test de connexion à la base de données
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT current_database()');
    res.json({
      success: true,
      database: result.rows[0].current_database,
      message: 'Connexion établie avec succès'
    });
  } catch (error) {
    console.error('Erreur test DB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Nom d\'utilisateur et mot de passe requis'
    });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, role FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    const user = result.rows[0];
    await logAction(username, 'login', 'users');

    res.json({
      success: true,
      username: user.username,
      role: user.role,
      userId: user.id
    });

  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion'
    });
  }
});

/* =========================
   Routes localités 
   ========================= */
// Charger toutes les régions
app.get('/regions', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nom FROM regions ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors du chargement des régions' });
  }
});

// Charger les départements d’une région
app.get('/departements/:regionId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom FROM departements WHERE region_id = $1 ORDER BY nom',
      [req.params.regionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors du chargement des départements' });
  }
});

// Charger les arrondissements d’un département
app.get('/arrondissements/:departementId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom FROM arrondissements WHERE departement_id = $1 ORDER BY nom',
      [req.params.departementId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors du chargement des arrondissements' });
  }
});
/* =========================
   Routes Users
   ========================= */
app.post('/users', async (req, res) => {
  try {
    const { username, password, role } = req.body;
	console.log('Création utilisateur : ', { username, role }); // LOG AJOUTÉ
    const sql = 'INSERT INTO users (username, password, role) VALUES ($1,$2,$3) RETURNING id, username, role, created_at';
    const result = await dbQueryWithUser(username || 'system', sql, [username, password, role]);
	console.log('Utilisateur créé :', result.rows[0]); //Log ajouté
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur détaillée :', err); //Log modifié
    res.status(500).json({ error: 'Erreur création utilisateur' });
  }
});

app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération utilisateurs' });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur suppression utilisateur' });
  }
});

/* =========================
   Routes admission
   ========================= */

/* =========================
   Routes Lots
   ========================= */
app.post('/lots', async (req, res) => {
  try {
    const {
      nom_producteur, tel_producteur, type_producteur, categorie,
      description, quantite, unite, prix_ref, qualite, date_reception, date_expiration, utilisateur
    } = req.body;

    const sql = `INSERT INTO lots 
       (nom_producteur, tel_producteur, type_producteur, categorie, description, quantite, unite, prix_ref, qualite, date_reception, date_expiration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`;

    const params = [nom_producteur, tel_producteur, type_producteur, categorie, description, quantite, unite, prix_ref, qualite, date_reception, date_expiration];
    const result = await dbQueryWithUser(utilisateur || nom_producteur || 'system', sql, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur création lot' });
  }
});

app.get('/lots', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lots ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération lots' });
  }
});

/* =========================
   Routes Operations Caisse
   ========================= */
app.post('/operations', async (req, res) => {
  try {
    const { utilisateur, type_operation, montant, producteur, description } = req.body;

    const client = await pool.connect();
    try {
	  await client.query('SELECT set_config($1, $2, true)', ['nbfo.current_user', utilisateur]);
      const lastRes = await client.query('SELECT solde_apres FROM operations_caisse ORDER BY id DESC LIMIT 1');
      let solde = lastRes.rows[0] ? Number(lastRes.rows[0].solde_apres) : 0;
      solde = (type_operation === 'credit') ? solde + Number(montant) : solde - Number(montant);

      const insertRes = await client.query(
        'INSERT INTO operations_caisse (utilisateur, type_operation, montant, solde_apres, producteur, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [utilisateur, type_operation, montant, solde, producteur, description]
      );

      res.json(insertRes.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur opération caisse' });
  }
});

app.get('/operations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operations_caisse ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération opérations caisse' });
  }
});

/* =========================
   Routes Stock
   ========================= */
app.post('/stock', async (req, res) => {
  try {
    const { produit, type_mouvement, quantite, unite, lot_id, magasin, utilisateur } = req.body;
    const sql = 'INSERT INTO stock (produit, type_mouvement, quantite, unite, lot_id, magasin) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *';
    const params = [produit, type_mouvement, quantite, unite, lot_id || null, magasin];
    const result = await dbQueryWithUser(utilisateur || 'magasinier', sql, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur enregistrement stock' });
  }
});

app.get('/stock', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stock ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération stock' });
  }
});

/* =========================
   Routes Cheques
   ========================= */
app.post('/cheques', async (req, res) => {
  try {
    const { numero_cheque, banque, montant, emetteur, utilisateur } = req.body;
    const sql = 'INSERT INTO cheques (numero_cheque, banque, montant, emetteur, utilisateur) VALUES ($1,$2,$3,$4,$5) RETURNING *';
    const params = [numero_cheque, banque, montant, emetteur, utilisateur];
    const result = await dbQueryWithUser(utilisateur || 'system', sql, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur enregistrement chèque' });
  }
});

app.get('/cheques', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cheques ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération chèques' });
  }
});

/* =========================
   Routes Messages
   ========================= */
app.post('/api/messages', async (req, res) => {
  try {
    const { sender, recipient, type, subject, body, date } = req.body;
    const sql = `INSERT INTO messages (sender, recipient, type, subject, body, date_sent) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const params = [sender, recipient, type, subject, body, date];
    const result = await pool.query(sql, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur envoi message' });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const username = req.query.user;
    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE recipient = $1 OR recipient = 'all' 
       ORDER BY date_sent DESC LIMIT 50`,
      [username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération messages' });
  }
});

/* =========================
   Routes Producteurs
   ========================= */
app.post('/api/producers', async (req, res) => {
  try {
    const { nom_producteur, tel_producteur, type_producteur, region, produits, utilisateur } = req.body;
    const sql = `INSERT INTO producteurs (nom_producteur, tel_producteur, type_producteur, region, produits) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const params = [nom_producteur, tel_producteur, type_producteur, region, produits];
    const result = await dbQueryWithUser(utilisateur || 'admin', sql, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur création producteur' });
  }
});

app.get('/api/producers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM producteurs ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération producteurs' });
  }
});

app.delete('/api/producers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM producteurs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur suppression producteur' });
  }
});

/* =========================
   Routes Validations
   ========================= */
app.get('/api/validations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM validations ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération validations' });
  }
});

app.post('/api/validations/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE validations SET status = 'approved' WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur validation' });
  }
});

app.post('/api/validations/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await pool.query(
      `UPDATE validations SET status = 'rejected', rejection_reason = $1 WHERE id = $2`,
      [reason, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur rejet' });
  }
});

/* =========================
   Routes Audit et vues
   ========================= */
app.get('/audit', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_log ORDER BY date_action DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération audit' });
  }
});

app.get('/lot-stock', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lot_stock_etat ORDER BY lot_id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération lot-stock' });
  }
});

app.get('/audit-details', async (req, res) => {
  try {
    const has = await pool.query("SELECT to_regclass('public.audit_details') AS v");
    if (has.rows[0].v) {
      const result = await pool.query('SELECT * FROM audit_details ORDER BY date_action DESC');
      res.json(result.rows);
    } else {
      const result = await pool.query('SELECT * FROM audit_log ORDER BY date_action DESC');
      res.json(result.rows);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération audit details' });
  }
});

/* =========================
   Servir les fichiers statiques
   ========================= */
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   Démarrage du serveur
   ========================= */
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 Base de données: ${process.env.PGDATABASE || 'nbfo'}`);
  console.log(`\n📍 Pages disponibles:`);
  console.log(`   - http://localhost:${PORT}/ (Connexion)`);
  console.log(`   - http://localhost:${PORT}/dashboard.html`);
  console.log(`   - http://localhost:${PORT}/administration.html`);
  console.log(`   - http://localhost:${PORT}/caisse.html`);
  console.log(`   - http://localhost:${PORT}/stock.html`);
});
