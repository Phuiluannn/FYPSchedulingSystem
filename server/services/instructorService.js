import InstructorModel from '../models/Instructor.js';
import UserModel from '../models/User.js';

// Get all instructors
export const getAllInstructors = async () => {
  return await InstructorModel.find();
};

// Get a single instructor by ID
export const getInstructorById = async (id) => {
  return await InstructorModel.findById(id);
};

// Create a new instructor
export const createInstructor = async (data) => {
  const instructor = new InstructorModel(data);
  const savedInstructor = await instructor.save();
  
  // 🔥 AUTO-CREATE USER ACCOUNT for the instructor using the special function
  try {
    const { createInstructorAccount } = await import('../services/authService.js');
    await createInstructorAccount({
      name: data.name,
      email: data.email
    });
  } catch (error) {
    console.error('❌ Error creating user account for instructor:', error);
    // Don't throw error - instructor record is already created
  }
  
  return savedInstructor;
};

// Update an instructor
export const updateInstructor = async (id, data) => {
  // Get the old instructor before updating
  const oldInstructor = await InstructorModel.findById(id);
  if (!oldInstructor) {
    throw new Error('Instructor not found');
  }
  
  const updatedInstructor = await InstructorModel.findByIdAndUpdate(id, data, { new: true });
  
  const CourseModel = (await import('../models/Course.js')).default;
  
  // If name changed, update all courses that reference the old name
  if (oldInstructor.name !== data.name) {
    await CourseModel.updateMany(
      { instructors: oldInstructor.name },
      { $set: { "instructors.$": data.name } }
    );
    console.log(`Updated instructor name in all courses from "${oldInstructor.name}" to "${data.name}"`);
    
    // 🔥 UPDATE USER ACCOUNT name if it exists
    try {
      const userAccount = await UserModel.findOne({ email: oldInstructor.email });
      if (userAccount) {
        userAccount.name = data.name;
        await userAccount.save();
        console.log(`✅ Updated user account name to: ${data.name}`);
      }
    } catch (error) {
      console.error('❌ Error updating user account name:', error);
    }
  }
  
  // 🔥 If email changed, update user account email
  if (oldInstructor.email !== data.email) {
    try {
      const userAccount = await UserModel.findOne({ email: oldInstructor.email });
      if (userAccount) {
        userAccount.email = data.email;
        await userAccount.save();
        console.log(`✅ Updated user account email to: ${data.email}`);
      }
    } catch (error) {
      console.error('❌ Error updating user account email:', error);
    }
  }
  
  // If status changed to Inactive, remove from all courses
  if (oldInstructor.status === 'Active' && data.status === 'Inactive') {
    await CourseModel.updateMany(
      { instructors: updatedInstructor.name },
      { $pull: { instructors: updatedInstructor.name } }
    );
    console.log(`Removed inactive instructor "${updatedInstructor.name}" from all courses`);
    
    // 🔥 DEACTIVATE USER ACCOUNT (optional - set status to inactive)
    try {
      const userAccount = await UserModel.findOne({ email: updatedInstructor.email });
      if (userAccount) {
        userAccount.status = 'inactive';
        await userAccount.save();
        console.log(`✅ Deactivated user account for: ${updatedInstructor.email}`);
      }
    } catch (error) {
      console.error('❌ Error deactivating user account:', error);
    }
  }
  
  // 🔥 If status changed back to Active, reactivate user account
  if (oldInstructor.status === 'Inactive' && data.status === 'Active') {
    try {
      const userAccount = await UserModel.findOne({ email: updatedInstructor.email });
      if (userAccount) {
        userAccount.status = 'unverified';
        await userAccount.save();
        console.log(`✅ Reactivated user account for: ${updatedInstructor.email}`);
      }
    } catch (error) {
      console.error('❌ Error reactivating user account:', error);
    }
  }
  
  return updatedInstructor;
};

// Delete an instructor
export const deleteInstructor = async (id) => {
  // First, get the instructor to find their name and email
  const instructor = await InstructorModel.findById(id);
  if (!instructor) {
    throw new Error('Instructor not found');
  }
  
  // Delete the instructor
  const deleted = await InstructorModel.findByIdAndDelete(id);
  
  // Remove this instructor from all courses
  const CourseModel = (await import('../models/Course.js')).default;
  await CourseModel.updateMany(
    { instructors: instructor.name },
    { $pull: { instructors: instructor.name } }
  );
  
  console.log(`Removed ${instructor.name} from all courses`);
  
  // 🔥 DELETE USER ACCOUNT associated with this instructor
  try {
    const deletedUser = await UserModel.findOneAndDelete({ email: instructor.email });
    if (deletedUser) {
      console.log(`✅ Deleted user account for: ${instructor.email}`);
    }
  } catch (error) {
    console.error('❌ Error deleting user account:', error);
  }
  
  return deleted;
};