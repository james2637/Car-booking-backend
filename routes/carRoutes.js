import { Router } from "express";
import {
  addCarToWishlist,
  createCar,
  deleteCar,
  getCarById,
  getCars,
  getWishlist,
  removeCarFromWishlist,
  updateCar,
} from "../controllers/carController.js";
import authenticate from "../middleware/authenticate.js";
import uploadCarImages from "../middleware/uploadCarImages.js";

const router = Router();

router.get("/wishlist", authenticate, getWishlist);
router.post("/:id/wishlist", authenticate, addCarToWishlist);
router.delete("/:id/wishlist", authenticate, removeCarFromWishlist);
router.route("/").post(uploadCarImages.array("images", 4), createCar).get(getCars);
router
  .route("/:id")
  .get(getCarById)
  .patch(uploadCarImages.array("images", 4), updateCar)
  .delete(deleteCar);

export default router;
