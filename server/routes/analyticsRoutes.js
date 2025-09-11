import express from "express";
import * as analyticsController from "../controllers/analyticsController.js";

const router = express.Router();

router.post("/record-conflict", analyticsController.recordConflict);
router.get("/conflicts", analyticsController.getConflicts);
router.put("/conflicts/:conflictId/resolve", analyticsController.resolveConflict);
router.get("/conflict-stats", analyticsController.getConflictStats);
router.get("/instructor-workload", analyticsController.getInstructorWorkload);
router.post('/auto-resolve', analyticsController.autoResolveConflicts);

router.use((req, res) => {
  res.status(404).send('analyticsRoutes 404: ' + req.originalUrl);
});

export default router;