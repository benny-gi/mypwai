// Fingerprint Enrollment Module
import express from 'express';
const router = express.Router();
// Enroll fingerprint
router.post('/enroll', (req, res) => {
    // TODO: Integrate fingerprint scanner SDK/API
    res.send('Fingerprint enrolled');
});
export default router;
//# sourceMappingURL=fingerprint.js.map