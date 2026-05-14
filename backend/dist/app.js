import express from 'express';
import attendanceRouter from './modules/attendance.js';
import aiRouter from './modules/ai.js';
import authRouter from './modules/auth.js';
const app = express();
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});
app.use(express.json({ limit: '20mb' }));
app.get('/', (req, res) => {
    res.send('Examination Attendance System Backend');
});
app.use('/api/attendance', attendanceRouter);
app.use('/api/ai', aiRouter);
app.use('/api/auth', authRouter);
export default app;
//# sourceMappingURL=app.js.map