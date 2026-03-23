const express = require("express");
const { body } = require("express-validator");
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// because all the routes here are protected, we can add protect middleware here
router.use(protect);

const createCategoryValidation = [
  body("name").trim().notEmpty().withMessage("Category name is required"),
];

const updateCategoryValidation = [
  body("name").optional().trim().notEmpty().withMessage("Category name cannot be empty"),
];

router.post("/", createCategoryValidation, createCategory);
router.get("/", getCategories);
router.put("/:id", updateCategoryValidation, updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
