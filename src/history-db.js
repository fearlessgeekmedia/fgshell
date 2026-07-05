const { Database } = require('bun:sqlite');
const path = require('path');
const os = require('os');
const Fuse = require('fuse.js');

const HISTORY_DB_PATH = path.join(os.homedir(), '.fgshell_history.db');

let db = null;

function initDB() {
  if (db) return;
  
  db = new Database(HISTORY_DB_PATH);
  
  // Create history table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      exit_code INTEGER,
      cwd TEXT,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_timestamp ON history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_cwd ON history(cwd);
  `);
}

function addEntry(command, exitCode, cwd, duration) {
  initDB();
  const timestamp = Math.floor(Date.now() / 1000);
  
  db.run(
    `INSERT INTO history (command, timestamp, exit_code, cwd, duration)
     VALUES (?, ?, ?, ?, ?)`,
    [command, timestamp, exitCode, cwd, duration]
  );
}

function getAll(limit = 1000) {
  initDB();
  try {
    const stmt = db.prepare(`
      SELECT id, command, timestamp, exit_code, cwd, duration
      FROM history
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  } catch (e) {
    console.error('getAll error:', e.message);
    return [];
  }
}

function search(query, limit = 50) {
  initDB();
  const entries = getAll(10000);
  
  const fuse = new Fuse(entries, {
    keys: ['command'],
    threshold: 0.3,
  });
  
  const results = fuse.search(query);
  return results.slice(0, limit).map(r => r.item);
}

function searchByExitCode(exitCode, limit = 50) {
  initDB();
  return db.query(`
    SELECT id, command, timestamp, exit_code, cwd, duration
    FROM history
    WHERE exit_code = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(exitCode, limit);
}

function searchByCwd(cwd, limit = 50) {
  initDB();
  return db.query(`
    SELECT id, command, timestamp, exit_code, cwd, duration
    FROM history
    WHERE cwd = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(cwd, limit);
}

function clearOlderThan(days) {
  initDB();
  const secondsAgo = days * 24 * 60 * 60;
  const cutoff = Math.floor(Date.now() / 1000) - secondsAgo;
  
  return db.run(`
    DELETE FROM history WHERE timestamp < ?
  `, [cutoff]);
}

function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDB,
  addEntry,
  getAll,
  search,
  searchByExitCode,
  searchByCwd,
  clearOlderThan,
  closeDB,
};
