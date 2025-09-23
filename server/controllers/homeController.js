import * as homeService from "../services/homeService.js";
import Schedule from "../models/Home.js";
import mongoose from "mongoose";
// 🔥 ADD THIS IMPORT
import { createTimetablePublishedNotification } from "../services/notificationService.js";
import * as analyticsService from "../services/analyticsService.js";

export const generateTimetable = async (req, res) => {
  try {
    const result = await homeService.generateTimetable(req);
    
    // NEW: Auto-resolve obsolete conflicts after generation
    try {
      const { year, semester } = req.body;
      console.log("Running auto-resolution after timetable generation...");
      // const autoResolveResult = await analyticsService.autoResolveObsoleteConflicts(year, semester);
      console.log(`Auto-resolved ${autoResolveResult.resolved} conflicts after generation`);
      
      // Add auto-resolution info to response
      result.autoResolved = autoResolveResult.resolved;
    } catch (autoResolveError) {
      console.warn("Auto-resolution failed, but timetable was generated:", autoResolveError);
      // Don't fail the generation if auto-resolution fails
    }
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const saveTimetable = async (req, res) => {
  try {
    const { year, semester, timetable } = req.body;
    console.log("=== SAVE TIMETABLE DEBUG ===");
    console.log(`Saving ${timetable.length} items for ${year} Semester ${semester}`);
    
    // CRITICAL FIX: Delete only draft schedules, never touch published ones
    const deleteResult = await Schedule.deleteMany({ 
      Year: year, 
      Semester: semester, 
      Published: { $ne: true }  // Only delete non-published schedules
    });
    console.log(`Deleted ${deleteResult.deletedCount} draft schedules`);

    const timetableWithObjectIds = timetable.map((item, index) => {
      console.log(`Processing item ${index}:`, {
        courseCode: item.CourseCode,
        selectedInstructor: item.selectedInstructor,
        selectedInstructorId: item.selectedInstructorId,
        instructors: item.Instructors,
        originalInstructors: item.OriginalInstructors
      });

      // Handle instructor assignments properly
      let instructorsToSave = [];
      let instructorIdToSave = null;

      // Priority 1: If instructor was manually assigned (selectedInstructor exists)
      if (item.selectedInstructor && item.selectedInstructor.trim() !== "") {
        instructorsToSave = [item.selectedInstructor];
        instructorIdToSave = item.selectedInstructorId && 
                           typeof item.selectedInstructorId === "string" && 
                           item.selectedInstructorId.length === 24
          ? new mongoose.Types.ObjectId(item.selectedInstructorId)
          : null;
        
        console.log(`Item ${index}: Using selected instructor: ${item.selectedInstructor} (ID: ${instructorIdToSave})`);
      }
      // Priority 2: If Instructors array has exactly one instructor (auto-assigned)
      else if (item.Instructors && Array.isArray(item.Instructors) && item.Instructors.length === 1) {
        instructorsToSave = item.Instructors;
        instructorIdToSave = item.InstructorID && 
                           typeof item.InstructorID === "string" && 
                           item.InstructorID.length === 24
          ? new mongoose.Types.ObjectId(item.InstructorID)
          : null;
        
        console.log(`Item ${index}: Using single instructor from array: ${item.Instructors[0]} (ID: ${instructorIdToSave})`);
      }
      // Priority 3: Use existing Instructors array or empty array
      else {
        instructorsToSave = item.Instructors || [];
        instructorIdToSave = null;
        
        console.log(`Item ${index}: No specific instructor assignment, using array: ${JSON.stringify(instructorsToSave)}`);
      }

      const updatedItem = {
        ...item,
        // Convert string IDs to ObjectIds
        CourseID: typeof item.CourseID === 'string' ? new mongoose.Types.ObjectId(item.CourseID) : item.CourseID,
        RoomID: typeof item.RoomID === 'string' ? new mongoose.Types.ObjectId(item.RoomID) : item.RoomID,
        InstructorID: instructorIdToSave,
        Instructors: instructorsToSave,
        OriginalInstructors: item.OriginalInstructors || item.instructors || instructorsToSave,
        // CRITICAL: Always save as draft (not published)
        Published: false,
        Year: year,
        Semester: semester
      };

      console.log(`Final item ${index}:`, {
        courseCode: updatedItem.CourseCode,
        instructors: updatedItem.Instructors,
        instructorID: updatedItem.InstructorID,
        originalInstructors: updatedItem.OriginalInstructors,
        published: updatedItem.Published
      });

      return updatedItem;
    });

    // Save new draft schedules
    await Schedule.insertMany(timetableWithObjectIds);
    
    console.log("=== SAVE COMPLETE ===");
    console.log(`Saved ${timetableWithObjectIds.length} draft schedules`);
    
try {
      console.log("Running auto-resolution after timetable save...");
      const autoResolveResult = await analyticsService.autoResolveObsoleteConflicts(year, semester);
      console.log(`Auto-resolved ${autoResolveResult.resolved} conflicts after save`);
    } catch (autoResolveError) {
      console.warn("Auto-resolution failed, but timetable was saved:", autoResolveError);
      // Don't fail the save operation if auto-resolution fails
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error in saveTimetable:", error);
    res.status(500).json({ error: error.message });
  }
  
};

export const getTimetable = async (req, res) => {
  try {
    const { year, semester, publishedOnly } = req.query;
    console.log("=== GET TIMETABLE DEBUG ===");
    console.log(`Fetching timetable: year=${year}, semester=${semester}, publishedOnly=${publishedOnly}`);
    
    const onlyPublished = publishedOnly === "true" || publishedOnly === true;
    console.log("Converted onlyPublished to boolean:", onlyPublished);

    let schedules = [];

    if (onlyPublished) {
      // USER SIDE: Only get published schedules
      console.log("USER SIDE REQUEST - fetching published schedules only");
      schedules = await Schedule.find({ 
        Year: year, 
        Semester: semester, 
        Published: true 
      }).lean();
      console.log(`Found ${schedules.length} published schedules for users`);
    } else {
      // ADMIN SIDE: Get draft schedules first, if none exist, copy from published
      console.log("ADMIN SIDE REQUEST - checking for draft schedules");
      
      const draftSchedules = await Schedule.find({ 
        Year: year, 
        Semester: semester, 
        Published: { $ne: true }
      }).lean();

      if (draftSchedules.length > 0) {
        // Use existing drafts
        schedules = draftSchedules;
        console.log(`Found ${schedules.length} draft schedules for admin`);
      } else {
        // No drafts exist, get published schedules for admin to start editing
        const publishedSchedules = await Schedule.find({ 
          Year: year, 
          Semester: semester, 
          Published: true 
        }).lean();
        
        if (publishedSchedules.length > 0) {
          // Create draft copies for admin to edit
          console.log(`No drafts found, creating draft copies from ${publishedSchedules.length} published schedules`);
          
          const draftCopies = publishedSchedules.map(schedule => ({
            ...schedule,
            _id: new mongoose.Types.ObjectId(), // New ID for draft copy
            Published: false // Mark as draft
          }));
          
          // Save draft copies
          await Schedule.insertMany(draftCopies);
          schedules = draftCopies;
          
          console.log(`Created ${draftCopies.length} draft copies for admin editing`);
        } else {
          schedules = [];
          console.log("No published or draft schedules found");
        }
      }
    }

    const schedulesWithStringIds = schedules.map(sch => ({
      ...sch,
      _id: sch._id?.toString?.() ?? sch._id,
      CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
      RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
    }));

    console.log(`Returning ${schedulesWithStringIds.length} schedules`);
    res.json({ schedules: schedulesWithStringIds });
  } catch (error) {
    console.error("Error in getTimetable:", error);
    res.status(500).json({ error: error.message });
  }
};

export const publishTimetable = async (req, res) => {
  try {
    const { year, semester } = req.body;
    console.log(`🚀 Publishing timetable for ${year} Semester ${semester}`);

    // Step 1: Get all draft schedules
    const draftSchedules = await Schedule.find({
      Year: year,
      Semester: semester,
      Published: { $ne: true }
    }).lean();

    if (draftSchedules.length === 0) {
      return res.status(400).json({ 
        error: "No draft schedules found to publish" 
      });
    }

    console.log(`Found ${draftSchedules.length} draft schedules to publish`);

    // Step 2: Delete all existing published schedules for this year/semester
    const deleteResult = await Schedule.deleteMany({
      Year: year,
      Semester: semester,
      Published: true
    });
    console.log(`Deleted ${deleteResult.deletedCount} existing published schedules`);

    // Step 3: Create published copies of draft schedules
    const publishedSchedules = draftSchedules.map(schedule => ({
      ...schedule,
      _id: new mongoose.Types.ObjectId(),
      Published: true
    }));

    // Step 4: Insert new published schedules
    const insertResult = await Schedule.insertMany(publishedSchedules);
    console.log(`Created ${insertResult.length} new published schedules`);

    // Step 5: 🔥 CREATE NOTIFICATION FOR TIMETABLE PUBLICATION
    try {
      console.log('📢 Creating notification for timetable publication...');
      await createTimetablePublishedNotification(year, semester);
      console.log(`✅ Notification created successfully for timetable publication: ${year} Semester ${semester}`);
    } catch (notificationError) {
      console.error("⚠️ Failed to create notification, but timetable was published:", notificationError);
      // Don't fail the entire publish operation if notification creation fails
    }

    res.json({ 
      success: true, 
      message: `Timetable for ${year} Semester ${semester} has been published and notifications sent to all users`,
      publishedCount: insertResult.length 
    });
  } catch (error) {
    console.error("❌ Error publishing timetable:", error);
    res.status(500).json({ error: error.message });
  }
};