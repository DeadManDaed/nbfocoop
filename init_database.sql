-- Script d'initialisation de la base de données NBFO
-- À exécuter dans PostgreSQL

-- Suppression des tables existantes (si nécessaire)
DROP TABLE IF EXISTS validations CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS producteurs CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS cheques CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS operations_caisse CASCADE;
DROP TABLE IF EXISTS lots CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'caisse', 'stock')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des lots
CREATE TABLE lots (
    id SERIAL PRIMARY KEY,
    nom_producteur VARCHAR(255) NOT NULL,
    tel_producteur VARCHAR(50),
    type_producteur VARCHAR(100),
    categorie VARCHAR(100),
    description TEXT NOT NULL,
    quantite NUMERIC(10, 2) NOT NULL,
    unite VARCHAR(50) NOT NULL,
    prix_ref NUMERIC(10, 2) NOT NULL,
    qualite VARCHAR(50),
    date_reception DATE,
    date_expiration DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des opérations de caisse
CREATE TABLE operations_caisse (
    id SERIAL PRIMARY KEY,
    utilisateur VARCHAR(100) NOT NULL,
    type_operation VARCHAR(20) NOT NULL CHECK (type_operation IN ('credit', 'debit')),
    montant NUMERIC(10, 2) NOT NULL,
    solde_apres NUMERIC(10, 2) NOT NULL,
    producteur VARCHAR(255),
    description TEXT,
    date_operation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des mouvements de stock
CREATE TABLE stock (
    id SERIAL PRIMARY KEY,
    produit VARCHAR(255) NOT NULL,
    type_mouvement VARCHAR(20) NOT NULL CHECK (type_mouvement IN ('entree', 'sortie')),
    quantite NUMERIC(10, 2) NOT NULL,
    unite VARCHAR(50) NOT NULL,
    lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL,
    magasin VARCHAR(255),
    date_mouvement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des chèques
CREATE TABLE cheques (
    id SERIAL PRIMARY KEY,
    numero_cheque VARCHAR(100) NOT NULL,
    banque VARCHAR(255) NOT NULL,
    montant NUMERIC(10, 2) NOT NULL,
    emetteur VARCHAR(255),
    utilisateur VARCHAR(100) NOT NULL,
    date_enregistrement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table d'audit
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    utilisateur VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    table_cible VARCHAR(100),
    date_action TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des messages
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender VARCHAR(100) NOT NULL,
    recipient VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    subject VARCHAR(255),
    body TEXT,
    date_sent TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des producteurs
CREATE TABLE producteurs (
    id SERIAL PRIMARY KEY,
    nom_producteur VARCHAR(255) NOT NULL,
    tel_producteur VARCHAR(50),
    type_producteur VARCHAR(100),
    region VARCHAR(100),
    produits TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des validations
CREATE TABLE validations (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100),
    utilisateur VARCHAR(100),
    details TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vue pour l'état des stocks par lot
CREATE OR REPLACE VIEW lot_stock_etat AS
SELECT 
    l.id AS lot_id,
    l.description,
    l.quantite AS quantite_initiale,
    COALESCE(
        l.quantite - 
        COALESCE((SELECT SUM(s.quantite) 
                  FROM stock s 
                  WHERE s.lot_id = l.id 
                  AND s.type_mouvement = 'sortie'), 0) +
        COALESCE((SELECT SUM(s.quantite) 
                  FROM stock s 
                  WHERE s.lot_id = l.id 
                  AND s.type_mouvement = 'entree'), 0),
        l.quantite
    ) AS quantite_restante
FROM lots l;

-- Insertion de données de test
INSERT INTO users (username, password, role) VALUES
    ('admin', 'admin123', 'admin'),
    ('caissier1', 'caisse123', 'caisse'),
    ('magasinier1', 'stock123', 'stock');

-- Insertion d'un lot de test
INSERT INTO lots (nom_producteur, tel_producteur, type_producteur, categorie, description, quantite, unite, prix_ref, qualite, date_reception) VALUES
    ('Jean Kouam', '+237 677123456', 'agriculteur', 'tubercules', 'Banane plantain de qualité', 500, 'kg', 1500, 'excellente', CURRENT_DATE);

-- Insertion d'une opération de test
INSERT INTO operations_caisse (utilisateur, type_operation, montant, solde_apres, producteur) VALUES
    ('admin', 'credit', 50000, 50000, 'Jean Kouam');

-- Insertion d'un mouvement de stock de test
INSERT INTO stock (produit, type_mouvement, quantite, unite, lot_id, magasin) VALUES
    ('Banane plantain', 'entree', 500, 'kg', 1, 'Magasin principal');

-- Index pour améliorer les performances
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_operations_date ON operations_caisse(date_operation);
CREATE INDEX idx_stock_date ON stock(date_mouvement);
CREATE INDEX idx_lots_producteur ON lots(nom_producteur);
CREATE INDEX idx_messages_recipient ON messages(recipient);
CREATE INDEX idx_audit_date ON audit_log(date_action);

-- Fonction trigger pour l'audit automatique (optionnel)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (utilisateur, action, table_cible)
    VALUES (
        COALESCE(current_setting('nbfo.current_user', true), 'system'),
        TG_OP,
        TG_TABLE_NAME
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer les triggers d'audit sur les tables principales
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_lots AFTER INSERT OR UPDATE OR DELETE ON lots
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_operations AFTER INSERT OR UPDATE OR DELETE ON operations_caisse
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_stock AFTER INSERT OR UPDATE OR DELETE ON stock
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Afficher un message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Base de données NBFO initialisée avec succès !';
    RAISE NOTICE '📊 Tables créées: users, lots, operations_caisse, stock, cheques, audit_log, messages, producteurs, validations';
    RAISE NOTICE '👤 Utilisateurs de test créés:';
    RAISE NOTICE '   - admin / admin123 (Administrateur)';
    RAISE NOTICE '   - caissier1 / caisse123 (Gestionnaire de caisse)';
    RAISE NOTICE '   - magasinier1 / stock123 (Gestionnaire de stock)';
END $$;