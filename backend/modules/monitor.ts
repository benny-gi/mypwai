// Real-Time Monitoring Module
import express from 'express';

const router = express.Router();

// Get real-time stats
router.get('/stats', (req, res) => {
  // TODO: Implement real-time stats logic
  res.send({ present: 0, absent: 0 });
});

export default router;
