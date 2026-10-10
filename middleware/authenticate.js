import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const authenticate = (req, res, next) => {
  const authorization = req.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured.");
    error.statusCode = 500;
    return next(error);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      !mongoose.Types.ObjectId.isValid(payload.sub)
    ) {
      return res.status(401).json({ message: "Invalid authentication token." });
    }

    req.userId = payload.sub;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Invalid or expired authentication token." });
    }
    return next(error);
  }
};

export default authenticate;
