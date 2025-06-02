import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']; // "Bearer <token>"

  if (!authHeader || authHeader === 'null' || authHeader.trim() === '') {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (err) {
      console.error("Token verification error:", err);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Session expired. Please log in again." });
      }
      return res.status(403).json({ message: "Invalid token" });
    }

    req.user = user; // Attach decoded user to request
    next();
  });
};
