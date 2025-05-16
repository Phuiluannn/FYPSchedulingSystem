import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']; // Get the token from the Authorization header
    console.log("Token from header:", token); // Debug log

    // Explicitly check for null, undefined, or empty string
    if (!token || token === 'null' || token.trim() === '') {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
        if (err) {
            console.error("Token verification error:", err);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Session expired. Please log in again." });
            }
            return res.status(403).json({ message: "Invalid token" });
        }
        console.log("Verified User:", user);
        req.user = user;
        next();
    });
};