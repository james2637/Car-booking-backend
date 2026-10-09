import { Router } from "express";
import {
  createCar,
  deleteCar,
  getCarById,
  getCars,
  updateCar,
} from "../controllers/carController.js";
import uploadCarImages from "../middleware/uploadCarImages.js";

const router = Router();

router.route("/").post(uploadCarImages.array("images", 4), createCar).get(getCars);
router
  .route("/:id")
  .get(getCarById)
  .patch(uploadCarImages.array("images", 4), updateCar)
  .delete(deleteCar);

export default router;
