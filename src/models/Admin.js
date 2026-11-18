import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
  // Tokens issued before this moment stop working (1s margin for clock rounding).
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});

adminSchema.methods.matchPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.methods.changedPasswordAfter = function (tokenIssuedAtSeconds) {
  if (!this.passwordChangedAt) return false;
  return Math.floor(this.passwordChangedAt.getTime() / 1000) > tokenIssuedAtSeconds;
};

export default mongoose.model("Admin", adminSchema);
