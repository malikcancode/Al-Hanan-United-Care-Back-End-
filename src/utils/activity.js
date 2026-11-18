import Activity from "../models/Activity.js";

// Records an admin action. Never blocks or fails the request that triggered it.
export const logActivity = (req, { action, entity, entityId, summary }) => {
  Activity.create({
    admin: req.admin?._id,
    adminName: req.admin?.name || "",
    action,
    entity,
    entityId,
    summary,
  }).catch((err) => console.warn(`[activity] could not record "${summary}": ${err.message}`));
};
