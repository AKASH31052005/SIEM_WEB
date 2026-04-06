const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/siem').then(async () => {
    try {
        await mongoose.connection.db.dropDatabase();
        console.log('Database wiped successfully');
    } catch (e) {
        console.error(e);
    }
    process.exit();
});
