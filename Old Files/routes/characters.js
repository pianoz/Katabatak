const router = require('express').Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// List current user's characters
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, g.name AS game_name FROM characters c
       JOIN games g ON c.game_id = g.id
       WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a character (user must be a player in the game)
router.post('/', async (req, res) => {
  const { name, game_id, class: cls, notes } = req.body;
  if (!name || !game_id) return res.status(400).json({ error: 'Name and game_id required' });
  try {
    const mem = await db.query(
      'SELECT 1 FROM game_memberships WHERE user_id = $1 AND game_id = $2',
      [req.user.id, game_id]
    );
    if (!mem.rows.length) return res.status(403).json({ error: 'Not a member of this game' });
    const { rows } = await db.query(
      'INSERT INTO characters (name, user_id, game_id, class, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, req.user.id, game_id, cls || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a character (owner only)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, g.name AS game_name,
         COALESCE(json_agg(sn.*) FILTER (WHERE sn.id IS NOT NULL), '[]') AS skills
       FROM characters c
       JOIN games g ON c.game_id = g.id
       LEFT JOIN character_skills cs ON c.id = cs.character_id
       LEFT JOIN skill_nodes sn ON cs.skill_node_id = sn.id
       WHERE c.id = $1 AND c.user_id = $2
       GROUP BY c.id, g.name`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Character not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a character (owner only)
router.put('/:id', async (req, res) => {
  const { name, class: cls, level, notes } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE characters SET
         name  = COALESCE($1, name),
         class = COALESCE($2, class),
         level = COALESCE($3, level),
         notes = COALESCE($4, notes)
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [name, cls, level, notes, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Character not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a character (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM characters WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Character not found' });
    res.json({ message: 'Character deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Unlock a skill for a character
router.post('/:id/skills/:skillId', async (req, res) => {
  try {
    const char = await db.query(
      'SELECT * FROM characters WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!char.rows.length) return res.status(404).json({ error: 'Character not found' });
    await db.query(
      'INSERT INTO character_skills (character_id, skill_node_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.params.skillId]
    );
    res.json({ message: 'Skill unlocked' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
