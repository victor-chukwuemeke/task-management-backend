const { validationResult } = require("express-validator");
const Category = require("../models/Category");
const Task = require("../models/Task");

// POST /api/categories
exports.createCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, color } = req.body;

    const existing = await Category.findOne({ name, user: req.user._id });
    if (existing) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }

    const category = await Category.create({ name, color, user: req.user._id });
    res.status(201).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

// GET /api/categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ user: req.user._id }).sort("name");
    res.status(200).json({ success: true, count: categories.length, categories });
  } catch (error) {
    next(error);
  }
};

// PUT /api/categories/:id
exports.updateCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (category.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/categories/:id
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (category.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const taskCount = await Task.countDocuments({ category: category._id });

    // If ?force=true, unset category on tasks; otherwise block deletion
    if (taskCount > 0) {
      if (req.query.force === "true") {
        await Task.updateMany({ category: category._id }, { $unset: { category: 1 } });
      } else {
        return res.status(400).json({
          success: false,
          message: `Category has ${taskCount} task(s). Use ?force=true to move them to uncategorized and delete.`,
        });
      }
    }

    await category.deleteOne();
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    next(error);
  }
};
