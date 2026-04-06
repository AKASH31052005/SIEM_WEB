const http = require('http');

http.get('http://localhost:5000/api/logs', (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log("Status:", res.statusCode);
    if(res.statusCode === 200) {
      try {
        const parsed = JSON.parse(data);
        console.log("Returned Logs Count:", parsed.length);
        if (parsed.length > 0) {
             const types = parsed.reduce((acc, log) => {
                 acc[log.logType] = (acc[log.logType] || 0) + 1;
                 return acc;
             }, {});
             console.log("LogTypes found:", types);
        }
      } catch(e) { console.error("JSON parse error"); }
    } else {
        console.log("Response:", data);
    }
  });

}).on("error", (err) => {
  console.log("Error: " + err.message);
});
