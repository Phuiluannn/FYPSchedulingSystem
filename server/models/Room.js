import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  building: { type: String, required: true },
  capacity: { type: Number, required: true, min: 0 },
  roomType: { type: String, required: true },
});

export default mongoose.model('Room', RoomSchema);