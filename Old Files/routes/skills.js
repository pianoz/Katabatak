const router = require('express').Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// Helper: verify caller is DM of a game
async function isDM(userId, gameId) {
  const { rows } = await db.query(
    'SELECT 1 FROM game_memberships WHERE user_id = $1 AND game_id = $2 AND role = $3',
    [userId, gameId, 'dm']
  );
  return rows.length > 0;
}

// Get full skill tree (nodes + edges) for a game
router.get('/game/:gameId', async (req, res) => {
  try {
    const mem = await db.query(
      'SELECT 1 FROM game_memberships WHERE user_id = $1 AND game_id = $2',
      [req.user.id, req.params.gameId]
    );
    if (!mem.rows.length) return res.status(403).json({ error: 'Not a member' });

    const [nodes, edges] = await Promise.all([
      db.query('SELECT * FROM skill_nodes WHERE game_id = $1 ORDER BY tier, id', [req.params.gameId]),
      db.query(
        `SELECT se.* FROM skill_edges se
         JOIN skill_nodes sn ON se.source_node_id = sn.id
         WHERE sn.game_id = $1`,
        [req.params.gameId]
      ),
    ]);
    res.json({ nodes: nodes.rows, edges: edges.rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a skill node (DM only)
router.post('/', async (req, res) => {
  const { game_id, name, description, tier, pos_x, pos_y } = req.body;
  if (!game_id || !name) return res.status(400).json({ error: 'game_id and name required' });
  try {
    if (!(await isDM(req.user.id, game_id))) return res.status(403).json({ error: 'DM only' });
    const { rows } = await db.query(
      'INSERT INTO skill_nodes (game_id, name, description, tier, pos_x, pos_y) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [game_id, name, description || null, tier ?? 0, pos_x ?? 0, pos_y ?? 0]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a skill node (DM only)
router.put('/:id', async (req, res) => {
  const { name, description, tier, pos_x, pos_y } = req.body;
  try {
    const node = await db.query('SELECT game_id FROM skill_nodes WHERE id = $1', [req.params.id]);
    if (!node.rows.length) return res.status(404).json({ error: 'Node not found' });
    if (!(await isDM(req.user.id, node.rows[0].game_id))) return res.status(403).json({ error: 'DM only' });
    const { rows } = await db.query(
      `UPDATE skill_nodes SET
         name        = COALESCE($1, name),
         description = COALESCE($2, description),
         tier        = COALESCE($3, tier),
         pos_x       = COALESCE($4, pos_x),
         pos_y       = COALESCE($5, pos_y)
       WHERE id = $6 RETURNING *`,
      [name, description, tier, pos_x, pos_y, req.params.id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a skill node (DM only)
router.delete('/:id', async (req, res) => {
  try {
    const node = await db.query('SELECT game_id FROM skill_nodes WHERE id = $1', [req.params.id]);
    if (!node.rows.length) return res.status(404).json({ error: 'Node not found' });
    if (!(await isDM(req.user.id, node.rows[0].game_id))) return res.status(403).json({ error: 'DM only' });
    await db.query('DELETE FROM skill_nodes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Node deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add an edge between two nodes (DM only; max 4 edges per node enforced by DB trigger)
router.post('/edge', async (req, res) => {
  const { source_node_id, target_node_id } = req.body;
  if (!source_node_id || !target_node_id) return res.status(400).json({ error: 'Both node IDs required' });
  try {
    const node = await db.query('SELECT game_id FROM skill_nodes WHERE id = $1', [source_node_id]);
    if (!node.rows.length) return res.status(404).json({ error: 'Node not found' });
    if (!(await isDM(req.user.id, node.rows[0].game_id))) return res.status(403).json({ error: 'DM only' });
    const { rows } = await db.query(
      'INSERT INTO skill_edges (source_node_id, target_node_id) VALUES ($1, $2) RETURNING *',
      [source_node_id, target_node_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('already has 4 edges')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove an edge (DM only)
router.delete('/edge/:id', async (req, res) => {
  try {
    const edge = await db.query(
      `SELECT sn.game_id FROM skill_edges se
       JOIN skill_nodes sn ON se.source_node_id = sn.id
       WHERE se.id = $1`,
      [req.params.id]
    );
    if (!edge.rows.length) return res.status(404).json({ error: 'Edge not found' });
    if (!(await isDM(req.user.id, edge.rows[0].game_id))) return res.status(403).json({ error: 'DM only' });
    await db.query('DELETE FROM skill_edges WHERE id = $1', [req.params.id]);
    res.json({ message: 'Edge deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
