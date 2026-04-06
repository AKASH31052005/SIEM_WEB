const mongoose = require("mongoose");
const MONGO_URI="mongodb+srv://akash3105:Akash123@m0.hdlgqki.mongodb.net/?appName=M0";

mongoose.connect(MONGO_URI).then(async () => {
    console.log("Connected");
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(collections.map(c => c.name));
    
    // Check specific collections
    const windowsCount = await mongoose.connection.db.collection("windowslogs").countDocuments();
    const webCount = await mongoose.connection.db.collection("weblogs").countDocuments();
    const netCount = await mongoose.connection.db.collection("networklogs").countDocuments();
    console.log("WindowsLogs:", windowsCount);
    console.log("WebLogs:", webCount);
    console.log("NetworkLogs:", netCount);
    
    process.exit(0);
}).catch(console.error);
