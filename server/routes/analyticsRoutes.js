import express from "express";
import * as analyticsController from "../controllers/analyticsController.js";
import { authenticateToken } from "../middleware/authenticateToken.js";

const router = express.Router();

// Protect all analytics routes
router.use(authenticateToken);

router.post("/record-conflict", analyticsController.recordConflict);
router.get("/conflicts", analyticsController.getConflicts);
router.put("/conflicts/:conflictId/resolve", analyticsController.resolveConflict);
router.get("/conflict-stats", analyticsController.getConflictStats);
router.get("/instructor-workload", analyticsController.getInstructorWorkload);
router.post('/auto-resolve', analyticsController.autoResolveConflicts);
router.get('/manually-resolved-conflicts', analyticsController.getManuallyResolvedConflicts);

router.use((req, res) => {
  res.status(404).send('analyticsRoutes 404: ' + req.originalUrl);
});

export default router;