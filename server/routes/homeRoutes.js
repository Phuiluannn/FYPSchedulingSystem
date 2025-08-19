import express from "express";
import * as homeController from "../controllers/homeController.js";

const router = express.Router();

router.post("/generate-timetable", homeController.generateTimetable);
router.post("/save-timetable", homeController.saveTimetable);
router.get("/get-timetable", homeController.getTimetable);
router.post("/publish-timetable", homeController.publishTimetable);


router.use((req, res) => {
  res.status(404).send('homeRoutes 404: ' + req.originalUrl);
});

export default router;