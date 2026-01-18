import * as analyticsService from "../services/analyticsService.js";

export const recordConflict = async (req, res) => {
  try {
    const conflict = await analyticsService.recordConflict(req.body);
    res.json({ success: true, conflict });
  } catch (error) {
    console.error("Error recording conflict:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getConflicts = async (req, res) => {
  try {
    const { year, semester } = req.query;
    const result = await analyticsService.getConflicts(year, semester);
    res.json(result);
  } catch (error) {
    console.error("Error fetching conflicts:", error);
    res.status(500).json({ error: error.message });
  }
};

export const resolveConflict = async (req, res) => {
  try {
    const { conflictId } = req.params;
    const conflict = await analyticsService.resolveConflict(conflictId);
    res.json({ success: true, conflict });
  } catch (error) {
    console.error("Error resolving conflict:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getConflictStats = async (req, res) => {
  try {
    const { year, semester } = req.query;
    const stats = await analyticsService.getConflictStats(year, semester);
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error fetching conflict statistics:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getInstructorWorkload = async (req, res) => {
  try {
    const { year, semester, publishedOnly } = req.query;
    
    // Convert publishedOnly to boolean (similar to how getTimetable handles it)
    const onlyPublished = publishedOnly === "true" || publishedOnly === true;
    
    console.log("=== WORKLOAD CONTROLLER DEBUG ===");
    console.log(`Year: ${year}, Semester: ${semester}, publishedOnly: ${publishedOnly}, onlyPublished: ${onlyPublished}`);
    
    const workload = await analyticsService.getInstructorWorkload(year, semester, onlyPublished);
    
    res.json({ success: true, workload });
  } catch (error) {
    console.error("Error fetching instructor workload:", error);
    res.status(500).json({ error: error.message });
  }
};

export const autoResolveConflicts = async (req, res) => {
  try {
    const { year, semester } = req.query;
    const result = await analyticsService.autoResolveObsoleteConflicts(year, semester);
    res.json({ 
      success: true, 
      message: `Auto-resolved ${result.resolved} obsolete conflicts`,
      resolvedConflicts: result.conflicts
    });
  } catch (error) {
    console.error("Error in auto-resolution:", error);
    res.status(500).json({ error: error.message });
  }
};
// 🔧 NEW: Get manually-resolved conflicts for frontend filtering
export const getManuallyResolvedConflicts = async (req, res) => {
  try {
    const { year, semester } = req.query;
    const result = await analyticsService.getManuallyResolvedConflicts(year, semester);
    res.json(result);
  } catch (error) {
    console.error("Error fetching manually-resolved conflicts:", error);
    res.status(500).json({ error: error.message });
  }
};