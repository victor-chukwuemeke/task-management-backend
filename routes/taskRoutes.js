const express = require("express");
const { body } = require("express-validator");
const {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  toggleStatus,
  getTaskStats,
  adminGetAllTasks,
} = require("../controllers/taskController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");

const router = express.Router();

// because all the routes here are protected, we can add protect middleware here
router.use(protect);

const createTaskValidation = [
  body("title").trim().notEmpty().withMessage("Task title is required"),
];

const updateTaskValidation = [
  body("title").optional().trim().notEmpty().withMessage("Task title cannot be empty"),
];

// Stats must come before :id routes
router.get("/stats", getTaskStats);

// Admin route
router.get("/admin/all", authorize("admin"), adminGetAllTasks);

router.post("/", createTaskValidation, createTask);
router.get("/", getTasks);
router.get("/:id", getTask);
router.put("/:id", updateTaskValidation, updateTask);
router.delete("/:id", deleteTask);
router.patch("/:id/status", toggleStatus);

module.exports = router;
