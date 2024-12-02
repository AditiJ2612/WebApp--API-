
const app = require('./app');
const importCSV = require('./app/csvConnection/csv');



//import csv users
importCSV();

const port = process.env.port || 8080;

app.listen(port,()=>{
  console.log(`Server is running on ${port}`);
})