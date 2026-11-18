import ApiError from "./ApiError.js";

// Saves a new display order: ids[0] gets order 1, ids[1] gets 2, and so on.
export const applyOrder = async (Model, ids) => {
  if (new Set(ids).size !== ids.length) throw new ApiError(400, "The list contains duplicates");

  const found = await Model.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw new ApiError(400, "Some items were not found. Refresh and try again.");

  await Model.bulkWrite(
    ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i + 1 } } } }))
  );
};
