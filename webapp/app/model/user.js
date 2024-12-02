const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt')
module.exports = (sequelize) => {
    const User = sequelize.define("users", {
        first_name: {
            type: DataTypes.STRING,
        },
        last_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        }
    });

    User.beforeCreate(async (user) => {
        if (user.password) {
            const saltRounds = 10; // Number of salt rounds for bcrypt
            const hashedPassword = await bcrypt.hash(user.password, saltRounds);
            user.password = hashedPassword;
        }
    });

    return User;
}









// const {Sequelize,DataTypes} = require('sequelize')
// module.exports = (sequelize,DataTypes) => {
//     const user = sequelize.define("users",{

//         first_name:{
//             type: DataTypes.STRING,
            
//         },
//         last_name:{
//             type:DataTypes.STRING,
//             allowNull: false
//         },
//         email:{
//             type:DataTypes.STRING,
//             allowNull:false
//         },
//         password:{
//             type:DataTypes.STRING,
//             allowNull:false
//         }
//     })

//     return user

// }