const mongoose = require("mongoose");
const Log = mongoose.model('Log', new mongoose.Schema({}, { strict: false }));
const WindowsLog = mongoose.model('windowslog', new mongoose.Schema({}, { strict: false }));
const NetworkLog = mongoose.model('networklog', new mongoose.Schema({}, { strict: false }));

const MONGO_URI="mongodb+srv://akash3105:Akash123@m0.hdlgqki.mongodb.net/?appName=M0";

mongoose.connect(MONGO_URI).then(async () => {
    const windowsLogs = await WindowsLog.find().sort({ TimeCreated: -1, createdAt: -1 }).limit(5);
    console.log("Sample WindowsLog:", JSON.stringify(windowsLogs, null, 2));
    
    process.exit(0);
}).catch(console.error);
