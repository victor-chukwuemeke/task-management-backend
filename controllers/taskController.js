const { validationResult } = require("express-validator");
const Task = require("../models/Task");

// POST /api/tasks
exports.createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, category, priority, status, dueDate } = req.body;

    if (dueDate && new Date(dueDate) < new Date()) {
      return res.status(400).json({ success: false, message: "Due date cannot be in the past" });
    }

    let task = await Task.create({
      title,
      description,
      category,
      priority,
      status,
      dueDate,
      user: req.user._id,
    });

    task = await task.populate([
      { path: "user", select: "name email" },
      { path: "category", select: "name color" },
    ]);

    res.status(201).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// GET /api/tasks
exports.getTasks = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };

    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Filter by priority
    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    // Filter by category
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Filter overdue
    if (req.query.overdue === "true") {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: "completed" };
    }

    // Filter by date range
    if (req.query.from || req.query.to) {
      filter.dueDate = filter.dueDate || {};
      if (req.query.from) filter.dueDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.dueDate.$lte = new Date(req.query.to);
    }

    // Search by title
    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: "i" };
    }

    // Sort
    let sortOption = { createdAt: -1 };
    if (req.query.sort) {
      switch (req.query.sort) {
        case "dueDate":
          sortOption = { dueDate: 1 };
          break;
        case "priority":
          sortOption = { priority: 1 };
          break;
        case "newest":
          sortOption = { createdAt: -1 };
          break;
        case "oldest":
          sortOption = { createdAt: 1 };
          break;
      }
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter)
      .populate("category", "name color")
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: tasks.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tasks/stats
exports.getTaskStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [totals, byPriority, byCategory] = await Promise.all([
      Task.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$status", "completed"] },
                      { $lt: ["$dueDate", new Date()] },
                      { $ne: ["$dueDate", null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Task.aggregate([
        { $match: { user: userId } },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: { user: userId } },
        {
          $lookup: {
            from: "categories",
            localField: "category",
            foreignField: "_id",
            as: "cat",
          },
        },
        { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$category",
            name: { $first: { $ifNull: ["$cat.name", "Uncategorized"] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = totals[0] || { total: 0, completed: 0, overdue: 0 };

    res.status(200).json({
      success: true,
      stats: {
        total: stats.total,
        completed: stats.completed,
        overdue: stats.overdue,
        byPriority: byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byCategory,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tasks/:id
exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate("category", "name color");

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (task.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// PUT /api/tasks/:id
exports.updateTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (task.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Handle completedAt auto-set
    if (req.body.status === "completed" && task.status !== "completed") {
      req.body.completedAt = new Date();
    } else if (req.body.status && req.body.status !== "completed") {
      req.body.completedAt = null;
    }

    task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("category", "name color");

    res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/tasks/:id
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (task.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await task.deleteOne();
    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/tasks/:id/status
exports.toggleStatus = async (req, res, next) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (task.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const statusFlow = { pending: "in-progress", "in-progress": "completed", completed: "pending" };
    const newStatus = statusFlow[task.status];

    const update = { status: newStatus };
    if (newStatus === "completed") {
      update.completedAt = new Date();
    } else {
      update.completedAt = null;
    }

    task = await Task.findByIdAndUpdate(req.params.id, update, { new: true }).populate(
      "category",
      "name color"
    );

    res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// GET /api/tasks/admin/all (admin only)
exports.adminGetAllTasks = async (req, res, next) => {
  try {
    const users = await require("../models/User")
      .find()
      .select("name email");

    const stats = await Task.aggregate([
      {
        $group: {
          _id: "$user",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", "completed"] },
                    { $lt: ["$dueDate", new Date()] },
                    { $ne: ["$dueDate", null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const statsMap = stats.reduce((acc, s) => {
      acc[s._id.toString()] = { total: s.total, completed: s.completed, overdue: s.overdue };
      return acc;
    }, {});

    const result = users.map((u) => ({
      user: u,
      stats: statsMap[u._id.toString()] || { total: 0, completed: 0, overdue: 0 },
    }));

    res.status(200).json({ success: true, users: result });
  } catch (error) {
    next(error);
  }
};
