import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Admin from "../models/Admin.js";
import Service from "../models/Service.js";
import Doctor from "../models/Doctor.js";
import Setting from "../models/Setting.js";

const services = [
  {
    title: "Video consultation",
    description: "Speak with a doctor face to face over a secure video call.",
    icon: "video",
  },
  {
    title: "Specialist care",
    description: "Get seen by the right specialist for your condition, without the commute.",
    icon: "heart",
  },
  {
    title: "Lab tests",
    description: "Book tests and receive your reports online, ready to review with your doctor.",
    icon: "flask",
  },
  {
    title: "Digital prescriptions",
    description:
      "Receive prescriptions and renewals after your consultation, with no paper needed.",
    icon: "file",
  },
  {
    title: "Child and family care",
    description: "Care for every member of your family, from children to grandparents.",
    icon: "users",
  },
  {
    title: "Follow-up by chat",
    description: "Ask follow-up questions after your visit and keep your care on track.",
    icon: "chat",
  },
].map((s, i) => ({ ...s, order: i + 1 }));

const doctors = [1, 2, 3].map((n) => ({
  name: "[DOCTOR NAME]",
  specialty: "[SPECIALTY]",
  qualifications: "[QUALIFICATIONS]",
  order: n,
}));

const settings = {
  clinicName: "Al Hanna United Care",
  phone: "[YOUR PHONE]",
  whatsapp: "[YOUR WHATSAPP]",
  email: "[YOUR EMAIL]",
  address: "[CLINIC ADDRESS]",
  hours: "[CLINIC HOURS]",
};

const reset = process.argv.includes("--reset");

const run = async () => {
  await connectDB();

  if (reset) {
    await Promise.all([Service.deleteMany(), Doctor.deleteMany(), Setting.deleteMany()]);
    console.log("Cleared services, doctors and settings");
  }

  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  const existingAdmin = await Admin.findOne({ email: ADMIN_EMAIL?.toLowerCase() });
  if (existingAdmin) {
    console.log(`Admin already exists: ${ADMIN_EMAIL}`);
  } else {
    await Admin.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    console.log(`Admin created: ${ADMIN_EMAIL}`);
  }

  if ((await Service.countDocuments()) === 0) {
    await Service.insertMany(services);
    console.log(`Inserted ${services.length} services`);
  }

  if ((await Doctor.countDocuments()) === 0) {
    await Doctor.insertMany(doctors);
    console.log(`Inserted ${doctors.length} doctors`);
  }

  if ((await Setting.countDocuments()) === 0) {
    await Setting.create(settings);
    console.log("Inserted clinic settings");
  }

  await mongoose.disconnect();
  console.log("Seeding complete");
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
