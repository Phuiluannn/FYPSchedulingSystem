import RoomModel from '../models/Room.js';

// Get all rooms
export const getAllRooms = async () => {
  return await RoomModel.find();
};

// Get a single room by ID
export const getRoomById = async (id) => {
  return await RoomModel.findById(id);
};

// Create a new room
export const createRoom = async (data) => {
  const room = new RoomModel(data);
  return await room.save();
};

// Update a room
export const updateRoom = async (id, data) => {
  return await RoomModel.findByIdAndUpdate(id, data, { new: true });
};

// Delete a room
export const deleteRoom = async (id) => {
  return await RoomModel.findByIdAndDelete(id);
};