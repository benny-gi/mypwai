import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        const message = error instanceof jwt.TokenExpiredError
            ? 'Token expired'
            : error instanceof jwt.JsonWebTokenError
                ? 'Invalid token'
                : 'Authentication failed';
        return res.status(401).json({ message });
    }
};
export default authMiddleware;
//# sourceMappingURL=auth.js.map