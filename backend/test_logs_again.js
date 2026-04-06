const http = require('http');

http.get('http://localhost:5000/api/logs?timeRange=all', (res) => {
  let data = '';
  res.on('data', (d) => data += d);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    try {
        const parsed = JSON.parse(data);
        console.log("Parsed length:", parsed.length);
        if (parsed.message) console.log("Message:", parsed.message);
    } catch(e) {
        console.log("Raw Response Snippet:", data.substring(0, 300));
    }
  });
}).on('error', e => console.error(e));
