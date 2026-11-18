import Appointment, { APPOINTMENT_STATUSES } from "../models/Appointment.js";
import Service from "../models/Service.js";
import Doctor from "../models/Doctor.js";
import Message from "../models/Message.js";
import Setting from "../models/Setting.js";
import Activity from "../models/Activity.js";
import { addDays, clinicDayStartInstant, clinicToday, dateKey } from "../utils/dates.js";

const POPULATE = [
  { path: "service", select: "title" },
  { path: "doctor", select: "name" },
];
const TREND_DAYS = 30;

// GET /api/dashboard/stats  (admin)
export const getStats = async (req, res) => {
  const timezone = await Setting.getTimezone();
  const today = clinicToday(timezone);
  const weekAhead = addDays(today, 7);
  const thisWeekStart = clinicDayStartInstant(timezone, -6); // last 7 days incl. today
  const lastWeekStart = clinicDayStartInstant(timezone, -13);
  const trendStart = clinicDayStartInstant(timezone, -(TREND_DAYS - 1));
  const notCancelled = { status: { $ne: "cancelled" } };

  const [
    byStatus,
    totalAppointments,
    services,
    doctors,
    recent,
    unreadMessages,
    todayList,
    todayCount,
    upcomingCount,
    thisWeek,
    lastWeek,
    trendRaw,
    topServices,
    activity,
    nextAppointment,
    requestsToday,
  ] = await Promise.all([
    Appointment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Appointment.countDocuments(),
    Service.countDocuments({ isActive: true }),
    Doctor.countDocuments({ isActive: true }),
    Appointment.find().populate(POPULATE).sort({ createdAt: -1 }).limit(6),
    Message.countDocuments({ status: "new" }),
    Appointment.find({ preferredDate: today, ...notCancelled })
      .populate(POPULATE)
      .sort({ time: 1, createdAt: 1 })
      .limit(8),
    Appointment.countDocuments({ preferredDate: today, ...notCancelled }),
    Appointment.countDocuments({ preferredDate: { $gt: today, $lte: weekAhead }, ...notCancelled }),
    Appointment.countDocuments({ createdAt: { $gte: thisWeekStart } }),
    Appointment.countDocuments({ createdAt: { $gte: lastWeekStart, $lt: thisWeekStart } }),
    Appointment.aggregate([
      { $match: { createdAt: { $gte: trendStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone } }, count: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
      { $match: { createdAt: { $gte: trendStart } } },
      { $group: { _id: "$service", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
      { $project: { _id: 0, id: "$_id", count: 1, title: { $ifNull: [{ $first: "$service.title" }, "Deleted service"] } } },
    ]),
    Activity.find().sort({ createdAt: -1 }).limit(8).lean(),
    // The next appointment after today, shown when today is empty
    Appointment.findOne({ preferredDate: { $gt: today }, ...notCancelled })
      .populate(POPULATE)
      .sort({ preferredDate: 1, time: 1, createdAt: 1 }),
    Appointment.countDocuments({ createdAt: { $gte: clinicDayStartInstant(timezone, 0) } }),
  ]);

  const statusCounts = Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [s, 0]));
  for (const { _id, count } of byStatus) statusCounts[_id] = count;

  // Fill every day of the window, including days with no requests.
  const counts = Object.fromEntries(trendRaw.map((d) => [d._id, d.count]));
  const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
    const key = dateKey(addDays(new Date(), i - (TREND_DAYS - 1)), timezone);
    return { date: key, count: counts[key] || 0 };
  });

  res.json({
    success: true,
    data: {
      timezone,
      today: dateKey(new Date(), timezone),
      totalAppointments,
      statusCounts,
      services,
      doctors,
      unreadMessages,
      recent,
      todayAppointments: { count: todayCount, items: todayList },
      upcomingWeek: upcomingCount,
      nextAppointment,
      requests: { today: requestsToday, thisWeek, lastWeek },
      trend,
      topServices,
      activity,
    },
  });
};
