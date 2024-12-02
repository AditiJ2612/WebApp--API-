const configureDB = require('../config/configureDB');

const {Sequelize, DataTypes} = require('sequelize');

//getting all of this
const sequelize = new Sequelize(
    configureDB.DB,
    configureDB.USER,
    configureDB.PASSWORD,{
        host: configureDB.HOST,
        dialect: configureDB.dialect,

    }
)

//autheticate

console.log("in model");

sequelize.authenticate()
  .then(() => {
    console.log("Connected to the database");
  })
  .catch(err => {
    console.error("Error connecting to the database:", err);
  });


const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.assignments = require('./assignment.js')(sequelize,DataTypes)
db.users = require('./user.js')(sequelize,DataTypes)
db.submissions = require('./submission.js')(sequelize,DataTypes)

// Define associations
db.assignments.hasMany(db.submissions, { foreignKey: 'assignment_id' });
db.submissions.belongsTo(db.assignments, { foreignKey: 'assignment_id' });

db.sequelize.sync({ force: false})
  .then(() => {
    console.log("Database syncing done");
  })
  .catch(err => {
    console.error("Error syncing the database:", err);
  });


module.exports = db;