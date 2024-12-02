const fs = require('fs');
const csv = require('csv-parser');
const { sequelize, DataTypes } = require('../model/model');
const User = require('../model/user.js')(sequelize, DataTypes);



const importCSV = async () => {
    try {
        const rows = await new Promise((resolve, reject) => {
            const rows = [];
            const filepath = 'users.csv';

            fs.createReadStream(filepath)
                .pipe(csv())
                .on('data', (row) => {
                    rows.push(row);
                })
                .on('end', () => {
                    resolve(rows);
                })
                .on('error', (error) => {
                    reject(`Error reading CSV: ${error.message}`);
                });
        });

        await sequelize.sync();

        const createUserPromises = [];

        for (const row of rows) {
            try {
                const existingUser = await User.findOne({ where: { email: row.email } });

                if (!existingUser) {
                    createUserPromises.push(User.create(row));
                }
            } catch (error) {
                throw new Error(`Error querying the database: ${error.message}`);
            }
        }

        await Promise.all(createUserPromises);

        return 'CSV file imported into MySQL database';
    } catch (error) {
        throw new Error(`Error importing CSV: ${error.message}`);
    }
};

module.exports = importCSV;
   